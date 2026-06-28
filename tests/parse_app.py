#!/usr/bin/env python3
try:
    from pyjsparser import PyJsParser
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pyjsparser', '-q'])
    from pyjsparser import PyJsParser

text = open(r'C:\civicradar\js\app.js', encoding='utf-8').read()
p = PyJsParser()
try:
    p.parse(text)
    print('OK')
except Exception as e:
    print('ERROR:', e)
