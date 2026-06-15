import os
def update_imports(filepath, replacements):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        for old, new in replacements:
            content = content.replace(old, new)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    except: pass

# ErrorBoundary
update_imports('d:/Codigo/SoftwareKioscos/frontend/src/components/ui/ErrorBoundary.jsx', [
    ('from "./ui/Icons"', 'from "./Icons"'),
    ('from \'./ui/Icons\'', 'from \'./Icons\'')
])

# All features
features_dir = 'd:/Codigo/SoftwareKioscos/frontend/src/features'
for f in os.listdir(features_dir):
    filepath = os.path.join(features_dir, f)
    update_imports(filepath, [
        ('from "../pages/PanelContext"', 'from "../context/PanelContext"'),
        ('from \'../pages/PanelContext\'', 'from \'../context/PanelContext\''),
        ('from "../pages/Icons"', 'from "../components/ui/Icons"'),
        ('from \'../pages/Icons\'', 'from \'../components/ui/Icons\'')
    ])

# Components
components_dir = 'd:/Codigo/SoftwareKioscos/frontend/src/components'
for root, _, files in os.walk(components_dir):
    for f in files:
        if f.endswith('.jsx'):
            filepath = os.path.join(root, f)
            update_imports(filepath, [
                ('from "../../pages/Icons"', 'from "../ui/Icons"'),
                ('from \'../../pages/Icons\'', 'from \'../ui/Icons\''),
                ('from "../pages/Icons"', 'from "./ui/Icons"'),
                ('from \'../pages/Icons\'', 'from \'./ui/Icons\'')
            ])
