# sitecustomize.py
# This script is automatically loaded by Python if the folder is in PYTHONPATH.
# It patches builtins and signal handling globally to allow Unix-centric and Python 2
# scripts to execute on Windows Python 3.10 environment.

import ssl
import sys
import builtins
import signal

# 1. Mock Unix signals and signal.alarm on Windows to prevent Unix tools (like lolcat) from crashing
if not hasattr(signal, 'SIGPIPE'):
    signal.SIGPIPE = 13
if not hasattr(signal, 'SIGALRM'):
    signal.SIGALRM = 14
if not hasattr(signal, 'SIG_DFL'):
    signal.SIG_DFL = 0

if not hasattr(signal, 'alarm'):
    def alarm_mock(seconds):
        return 0
    signal.alarm = alarm_mock

original_signal_func = signal.signal
def patched_signal_func(sig, handler):
    try:
        if sig in (13, 14):  # Ignore Unix SIGPIPE/SIGALRM on Windows
            return None
        return original_signal_func(sig, handler)
    except (ValueError, OSError):
        return None

signal.signal = patched_signal_func

# 2. Patch Python 2 builtins for Python 3 compatibility
if not hasattr(builtins, 'raw_input'):
    builtins.raw_input = input
if not hasattr(builtins, 'xrange'):
    builtins.xrange = range
if not hasattr(builtins, 'unicode'):
    builtins.unicode = str
if not hasattr(builtins, 'basestring'):
    builtins.basestring = str
if not hasattr(builtins, 'long'):
    builtins.long = int

# 2b. Patch sys.stdout to add .print() method if it's missing (fixes lolcat on Windows)
if not hasattr(sys.stdout, 'print') or not callable(sys.stdout.print):
    try:
        def _stdout_print(s='', *args, **kwargs):
            sys.stdout.write(str(s))
        sys.stdout.print = _stdout_print
    except Exception:
        pass

# 3. Patch SSL default context (urllib, urllib2, etc.) to bypass certificate errors
try:
    ssl._create_default_https_context = ssl._create_unverified_context
except Exception:
    pass

# 4. Patch requests library
try:
    import requests
    original_send = requests.Session.send
    
    def patched_send(self, request, **kwargs):
        kwargs['verify'] = False
        return original_send(self, request, **kwargs)
        
    requests.Session.send = patched_send
    
    # Disable SSL warnings
    try:
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    except Exception:
        pass
except ImportError:
    pass
