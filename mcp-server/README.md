# NovaStock MCP Server

## ¿Qué es?
Un servidor MCP que permite a cualquier agente de IA (opencode, Claude, Codex) interactuar
con el proyecto NovaStock de forma autónoma: buscar código, ejecutar builds, tests, etc.

## Tools disponibles

### search
Busca archivos por nombre o contenido en el proyecto.
```
{
  "query": "handleSearch",        // texto a buscar
  "scope": "frontend",            // all | backend | frontend
  "mode": "content",              // filename | content | both
  "file_pattern": "*.jsx"         // filtro opcional
}
```

### use_tool
Ejecuta acciones predefinidas o comandos personalizados.
```
acciones predefinidas:
  build_frontend       → npx vite build
  test_backend         → pytest tests/ -v
  test_backend_stress  → pytest tests/test_stress.py -v
  compile_backend      → python -m py_compile main.py
  run_backend          → python main.py
  custom               → comando libre (usar action:"custom", command:"...")
```

## Cómo lo uso con opencode

Ya está registrado en:
- `opencode.json` (raíz del proyecto)
- `~/.config/opencode/opencode.jsonc` (global)

Cuando abras opencode en `D:\Codigo\SoftwareKioscos`, se conecta automáticamente.
Podés hablarle al agente como siempre, pero ahora tiene acceso a estas tools.

## Ejemplos de prompts

> "Buscá todos los archivos JSX que importan useCart y decime cuántos son"

> "Ejecutá build_frontend y si falla, mostrame el error"

> "Buscá en backend qué funciones no tienen type hints y agregalos"

> "Corré los stress tests y decime si pasan todos"

> "Buscá TODO y FIXME en todo el proyecto"

## Cómo probar que funciona
```powershell
cd D:\Codigo\SoftwareKioscos
python mcp-server/server.py
```
El servidor queda escuchando por stdio. Cerrar con Ctrl+C.

## Si querés conectarlo a Claude Desktop
En la config de Claude Desktop agregá:
```json
{
  "mcpServers": {
    "novastock": {
      "command": "python",
      "args": ["D:\\Codigo\\SoftwareKioscos\\mcp-server\\server.py"]
    }
  }
}
```
