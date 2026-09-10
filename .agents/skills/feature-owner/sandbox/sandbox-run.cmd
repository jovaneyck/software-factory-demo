@echo off
rem sandbox-run.cmd - Windows shim for sandbox-run.sh
rem
rem herdr panes default to PowerShell/cmd, where bare `bash` resolves to WSL bash
rem (which cannot exec this repo's msys scripts). PowerShell resolves `.cmd` files
rem natively, so the feature-owner invokes THIS shim; it locates Git Bash and
rem forwards all arguments to sandbox-run.sh unchanged.
rem
rem Usage (from a herdr pane run):
rem   .agents\skills\feature-owner\sandbox\sandbox-run.cmd --run-id <id> -- pi --model ... 
setlocal
set "BASH=%ProgramFiles%\Git\bin\bash.exe"
if not exist "%BASH%" set "BASH=%ProgramFiles%\Git\usr\bin\bash.exe"
if not exist "%BASH%" (
  echo ERROR: Git Bash not found. Install Git for Windows or set the path in sandbox-run.cmd. 1>&2
  exit /b 1
)
"%BASH%" "%~dp0sandbox-run.sh" %*
