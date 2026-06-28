@echo off
set CIVICRADAR_TEST_PORT=9080
cd /d C:\civicradar
python tests\e2e_comprehensive.py > tests\e2e-last-run.txt 2>&1
echo EXIT=%ERRORLEVEL%
