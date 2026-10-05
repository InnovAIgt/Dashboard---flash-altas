@echo off
REM Robot para tu computadora (cuando SAN solo funciona en la red de la empresa):
REM pide los datos a SAN y los sube a GitHub. Se programa con el Programador de tareas de Windows.
cd /d "%~dp0"
node actualizar.js || exit /b 1
git add docs/datos.json
git diff --cached --quiet && (echo Sin cambios & exit /b 0)
git commit -m "Actualizar datos de Flash"
git pull --rebase
git push
