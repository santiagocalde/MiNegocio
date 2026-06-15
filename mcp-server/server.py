from mcp.server.models import InitializationOptions
import mcp.server.stdio as stdio_server
import mcp.server.models as models
import mcp.types as types
from mcp.server import NotificationOptions, Server
import os
import subprocess
import json
import fnmatch

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
IGNORE_DIRS = {"node_modules", ".git", "__pycache__", ".venv", "dist", ".pytest_cache"}

server = Server("novastock-mcp")


def _should_ignore(path):
    rel = os.path.relpath(path, PROJECT_ROOT)
    parts = rel.split(os.sep)
    return any(p in IGNORE_DIRS for p in parts)


def _find_files(scope=None):
    base = PROJECT_ROOT
    if scope == "backend":
        base = BACKEND_DIR
    elif scope == "frontend":
        base = FRONTEND_DIR
    matches = []
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in files:
            fp = os.path.join(root, f)
            if not _should_ignore(fp):
                matches.append(os.path.relpath(fp, PROJECT_ROOT))
    return matches


@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="search",
            description="Buscar archivos y contenido en el proyecto NovaStock",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Texto a buscar (nombre de archivo o contenido)",
                    },
                    "scope": {
                        "type": "string",
                        "enum": ["all", "backend", "frontend"],
                        "description": "Ámbito de búsqueda",
                        "default": "all",
                    },
                    "mode": {
                        "type": "string",
                        "enum": ["filename", "content", "both"],
                        "description": "Modo de búsqueda",
                        "default": "both",
                    },
                    "file_pattern": {
                        "type": "string",
                        "description": "Filtro por patrón de archivo (ej: *.py, *.jsx)",
                        "default": "",
                    },
                },
                "required": ["query"],
            },
        ),
        types.Tool(
            name="use_tool",
            description="Ejecutar comandos del proyecto NovaStock (build, test, lint, etc.)",
            inputSchema={
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": [
                            "build_frontend",
                            "test_backend",
                            "test_backend_stress",
                            "compile_backend",
                            "run_backend",
                            "custom",
                        ],
                        "description": "Acción predefinida a ejecutar",
                    },
                    "command": {
                        "type": "string",
                        "description": "Comando personalizado (solo si action=custom)",
                        "default": "",
                    },
                    "cwd": {
                        "type": "string",
                        "description": "Directorio de trabajo (backend|frontend|project)",
                        "default": "project",
                    },
                },
                "required": ["action"],
            },
        ),
    ]


@server.call_tool()
async def handle_call_tool(
    name: str, arguments: dict | None
) -> list[types.TextContent | types.ImageContent | types.EmbeddedResource]:
    if not arguments:
        arguments = {}

    if name == "search":
        query = arguments.get("query", "")
        scope = arguments.get("scope", "all")
        mode = arguments.get("mode", "both")
        file_pattern = arguments.get("file_pattern", "")

        results = []
        files = _find_files(scope)

        for rel_path in files:
            full_path = os.path.join(PROJECT_ROOT, rel_path)
            if fnmatch.fnmatch(rel_path, file_pattern) or not file_pattern:
                if mode in ("filename", "both") and query.lower() in rel_path.lower():
                    results.append({"file": rel_path, "match_type": "filename"})
                    continue
                if mode in ("content", "both"):
                    try:
                        with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                            for i, line in enumerate(f, 1):
                                if query.lower() in line.lower():
                                    results.append({
                                        "file": rel_path,
                                        "line": i,
                                        "content": line.rstrip()[:200],
                                        "match_type": "content",
                                    })
                    except Exception:
                        pass

        limit = min(len(results), 50)
        summary = f"Encontradas {len(results)} coincidencias (mostrando {limit})" if results else "Sin resultados"
        return [types.TextContent(
            type="text",
            text=json.dumps({
                "summary": summary,
                "count": len(results),
                "results": results[:50],
            }, ensure_ascii=False, indent=2),
        )]

    elif name == "use_tool":
        action = arguments.get("action", "")
        command = arguments.get("command", "")
        cwd = arguments.get("cwd", "project")

        dir_map = {
            "backend": BACKEND_DIR,
            "frontend": FRONTEND_DIR,
            "project": PROJECT_ROOT,
        }
        work_dir = dir_map.get(cwd, PROJECT_ROOT)

        actions_map = {
            "build_frontend": ("npx.cmd" if os.name == "nt" else "npx", ["vite", "build"]),
            "test_backend": ("python", ["-m", "pytest", "tests/", "-v"]),
            "test_backend_stress": ("python", ["-m", "pytest", "tests/test_stress.py", "-v"]),
            "compile_backend": ("python", ["-m", "py_compile", "main.py"]),
            "run_backend": ("python", ["main.py"]),
        }

        if action == "custom" and command:
            cmd_parts = command.split()
            executable = cmd_parts[0]
            args = cmd_parts[1:]
            cwd_override = FRONTEND_DIR if "vite" in command else BACKEND_DIR if "pytest" in command or "py_compile" in command else PROJECT_ROOT
            work_dir = dir_map.get(arguments.get("cwd", ""), cwd_override)
        elif action in actions_map:
            executable, args = actions_map[action]
        else:
            return [types.TextContent(type="text", text=json.dumps({
                "status": "error",
                "error": f"Acción desconocida: {action}",
            }))]

        try:
            result = subprocess.run(
                [executable] + args,
                cwd=work_dir,
                capture_output=True,
                text=True,
                timeout=120,
            )
            output = result.stdout + result.stderr
            return [types.TextContent(type="text", text=json.dumps({
                "status": "ok" if result.returncode == 0 else "error",
                "returncode": result.returncode,
                "output": output[-5000:],
            }, ensure_ascii=False, indent=2))]
        except subprocess.TimeoutExpired:
            return [types.TextContent(type="text", text=json.dumps({
                "status": "error",
                "error": "Comando timed out (>120s)",
            }))]
        except FileNotFoundError as e:
            return [types.TextContent(type="text", text=json.dumps({
                "status": "error",
                "error": f"Ejecutable no encontrado: {e}",
            }))]
        except Exception as e:
            return [types.TextContent(type="text", text=json.dumps({
                "status": "error",
                "error": str(e),
            }))]

    return [types.TextContent(type="text", text=json.dumps({"status": "error", "error": f"Tool desconocida: {name}"}))]


@server.list_prompts()
async def handle_list_prompts() -> list[types.Prompt]:
    return []


@server.get_prompt()
async def handle_get_prompt(
    name: str, arguments: dict[str, str] | None
) -> types.GetPromptResult:
    raise ValueError(f"Prompt desconocido: {name}")


async def main():
    async with stdio_server.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="novastock-mcp",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
