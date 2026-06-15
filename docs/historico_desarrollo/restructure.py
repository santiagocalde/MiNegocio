import os
import shutil

def update_imports_in_file(filepath, replacements):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        modified = False
        for old, new in replacements:
            if old in content:
                content = content.replace(old, new)
                modified = True
                
        if modified:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated imports in {filepath}")
    except Exception as e:
        print(f"Error updating {filepath}: {e}")

def get_all_js_files(start_path):
    js_files = []
    for root, _, files in os.walk(start_path):
        for f in files:
            if f.endswith('.js') or f.endswith('.jsx'):
                js_files.append(os.path.join(root, f))
    return js_files

def get_all_py_files(start_path):
    py_files = []
    for root, _, files in os.walk(start_path):
        for f in files:
            if f.endswith('.py') and 'venv' not in root and 'site-packages' not in root:
                py_files.append(os.path.join(root, f))
    return py_files

def refactor_frontend():
    print("Refactoring Frontend...")
    base_src = 'd:/Codigo/SoftwareKioscos/frontend/src'
    
    # Create new directories
    os.makedirs(os.path.join(base_src, 'components/ui'), exist_ok=True)
    os.makedirs(os.path.join(base_src, 'features'), exist_ok=True)
    os.makedirs(os.path.join(base_src, 'context'), exist_ok=True)
    os.makedirs(os.path.join(base_src, 'layouts'), exist_ok=True)
    
    # Files to move
    moves = {
        'pages/Icons.jsx': 'components/ui/Icons.jsx',
        'components/ErrorBoundary.jsx': 'components/ui/ErrorBoundary.jsx',
        'pages/PanelContext.jsx': 'context/PanelContext.jsx',
        'pages/PanelLayout.jsx': 'layouts/PanelLayout.jsx',
    }
    
    # Add modules to moves
    for f in os.listdir(os.path.join(base_src, 'components')):
        if f.endswith('Module.jsx'):
            moves[f'components/{f}'] = f'features/{f}'
            
    # Do the moves
    for src, dst in moves.items():
        src_path = os.path.join(base_src, src)
        dst_path = os.path.join(base_src, dst)
        if os.path.exists(src_path):
            shutil.move(src_path, dst_path)
            print(f"Moved {src} -> {dst}")
            
    # Replacements dictionary (naive string replacements)
    replacements = [
        # Icons replacements
        ("from './Icons'", "from '../components/ui/Icons'"),
        ("from './Icons.jsx'", "from '../components/ui/Icons.jsx'"),
        ("from '../pages/Icons'", "from './ui/Icons'"),
        ("from '../pages/Icons.jsx'", "from './ui/Icons.jsx'"),
        ("from '../../pages/Icons'", "from '../ui/Icons'"),
        
        # PanelContext replacements
        ("from './pages/PanelContext'", "from './context/PanelContext'"),
        ("from './PanelContext'", "from '../context/PanelContext'"),
        
        # PanelLayout replacements
        ("from './pages/PanelLayout'", "from './layouts/PanelLayout'"),
        
        # ErrorBoundary replacements
        ("from './components/ErrorBoundary'", "from './components/ui/ErrorBoundary'"),
    ]
    
    # Add module replacements for App.jsx
    for f in os.listdir(os.path.join(base_src, 'features')):
        name = f.replace('.jsx', '')
        replacements.append((f"from './components/{name}'", f"from './features/{name}'"))
        
    # Extra fixes for features that were in components and imported things relative to components
    # A feature was at src/components/StockModule.jsx (level 1)
    # Now it is at src/features/StockModule.jsx (level 1)
    # The relative paths to components/ui or components/pos are now different!
    # Old: import ... from './pos/SearchBar'
    # New: import ... from '../components/pos/SearchBar'
    feature_replacements = [
        ("from './pos/", "from '../components/pos/"),
        ("from './ui/", "from '../components/ui/"),
        ("from '../services/", "from '../services/"), # same level
        ("from '../hooks/", "from '../hooks/"), # same level
        ("from '../pages/Icons", "from '../components/ui/Icons"),
        ("from './TicketPrint'", "from '../components/TicketPrint'"),
        ("from './ConfigModal'", "from '../components/ConfigModal'"),
    ]

    # Process all files
    all_js = get_all_js_files(base_src)
    for js_file in all_js:
        # If it's a feature file, apply extra replacements
        file_repls = list(replacements)
        if 'features\\' in js_file or 'features/' in js_file:
            file_repls.extend(feature_replacements)
            
        # UI components were in components, now in components/ui
        if 'components\\ui' in js_file or 'components/ui' in js_file:
            # Error boundary was at components/ErrorBoundary.jsx
            # Old: from '../pages/Icons'
            # New: from './Icons'
            if 'ErrorBoundary' in js_file:
                file_repls.append(("from '../pages/Icons'", "from './Icons'"))
                
        update_imports_in_file(js_file, file_repls)

def refactor_backend():
    print("\nRefactoring Backend...")
    base_src = 'd:/Codigo/SoftwareKioscos/backend'
    
    # The backend is mostly modular. Let's just create an app/ folder or keep it as is.
    # Actually, typical FastAPI is:
    # backend/
    #   core/
    #   api/
    #     routers/
    #   services/
    #   schemas/
    #   main.py
    # Since routers are already cleanly in `routers/`, we can rename it to `api/` or leave it.
    # Moving `database.py` and `core_dependencies.py` to `core/` is standard.
    
    moves = {
        'database.py': 'core/database.py',
        'core_dependencies.py': 'core/dependencies.py',
        'agent.py': 'services/agent.py',
    }
    
    for src, dst in moves.items():
        src_path = os.path.join(base_src, src)
        dst_path = os.path.join(base_src, dst)
        if os.path.exists(src_path):
            os.makedirs(os.path.dirname(dst_path), exist_ok=True)
            shutil.move(src_path, dst_path)
            print(f"Moved {src} -> {dst}")

    # Replacements for backend
    replacements = [
        ("from database import", "from core.database import"),
        ("import database", "import core.database as database"),
        ("from core_dependencies import", "from core.dependencies import"),
        ("import core_dependencies", "import core.dependencies as core_dependencies"),
        ("from agent import", "from services.agent import"),
    ]
    
    all_py = get_all_py_files(base_src)
    for py_file in all_py:
        # Don't touch the script itself or venv
        if 'restructure.py' in py_file:
            continue
        update_imports_in_file(py_file, replacements)

if __name__ == '__main__':
    refactor_frontend()
    refactor_backend()
    print("Done!")
