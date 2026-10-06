<# : batch portion
@echo off
setlocal
set "QX_SELF=%~f0"
set "QX_MODE=%~1"
set "QX_USER=%~2"
set "QX_RESULT=%~3"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=[IO.File]::ReadAllText($env:QX_SELF,[Text.Encoding]::UTF8); Invoke-Expression $s"
set "RC=%errorlevel%"
if not "%RC%"=="0" if not "%RC%"=="2" if not "%RC%"=="3010" pause
exit /b %RC%
#>

# cmd.exe выполняет строки выше, PowerShell считает их комментарием и выполняет всё ниже.
# QADAMIX: установка WSL 2 + Docker Desktop и запуск проекта на Windows 10/11.
# Запуск: двойной щелчок по setup-windows.cmd. Файл можно запускать повторно:
# уже установленное пропускается, после перезагрузки установка продолжается сама.

[Console]::OutputEncoding = [Text.Encoding]::UTF8
$env:WSL_UTF8 = '1'
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$Self = $env:QX_SELF
$RepoUrl = 'https://github.com/Panzershreck211/Qadamix-.git'
$DockerExe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
$RunOnceKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce'
$RebootMarker = Join-Path $env:TEMP 'qadamix-setup-rebooted'

function Step($t) { Write-Host ''; Write-Host "==> $t" -ForegroundColor Cyan }
function Ok($t)   { Write-Host "    [OK] $t" -ForegroundColor Green }
function Warn($t) { Write-Host "    [!] $t" -ForegroundColor Yellow }
function Fail($t) {
  Write-Host ''; Write-Host "ОШИБКА: $t" -ForegroundColor Red
  Write-Host 'Пришлите скриншот этого окна — подскажу, что делать.'
  Read-Host 'Нажмите Enter, чтобы закрыть'
  exit 2
}
function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  $dockerBin = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin'
  if (Test-Path $dockerBin) { $env:Path += ";$dockerBin" }
}
function Is-Admin {
  $p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
function Has-Git    { Refresh-Path; return [bool](Get-Command git -ErrorAction SilentlyContinue) }
function Has-Docker { return (Test-Path $DockerExe) }
function Has-Wsl {
  if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { return $false }
  $null = & wsl.exe --status 2>&1
  return ($LASTEXITCODE -eq 0)
}
function Winget-Install($id, $extra) {
  $a = @('install', '-e', '--id', $id, '--source', 'winget', '--accept-source-agreements', '--accept-package-agreements') + $extra
  & winget @a
}

# ---------------------------------------------------------------- Установка (нужны права администратора)
# Возвращает $true, если нужна перезагрузка.
function Install-Prereqs {
  $reboot = $false
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Fail 'Не найден winget. Установите «Установщик приложений» (App Installer) из Microsoft Store и запустите этот файл снова.'
  }

  if (-not (Has-Git)) {
    Step 'Устанавливаю Git'
    Winget-Install 'Git.Git' @('--silent')
    if (-not (Has-Git)) { Fail 'Git не установился.' }
    Ok 'Git установлен'
  }

  if (-not (Has-Wsl)) {
    Step 'Устанавливаю WSL 2 (подсистема Linux для Docker)'
    & wsl.exe --install --no-distribution
    $reboot = $true
    Ok 'WSL установлен, нужна перезагрузка'
  } else {
    & wsl.exe --update 2>&1 | Out-Null
  }

  if (-not (Has-Docker)) {
    Step 'Устанавливаю Docker Desktop (скачивание ~600 МБ, подождите)'
    Winget-Install 'Docker.DockerDesktop' @('--override', 'install --quiet --accept-license --backend=wsl-2')
    if (-not (Has-Docker)) { Fail 'Docker Desktop не установился.' }
    $reboot = $true
    Ok 'Docker Desktop установлен'
  }

  # Пользователь должен быть в группе docker-users, иначе Docker не запустится без прав администратора
  $user = $env:QX_USER
  if (-not $user) { $user = "$env:USERDOMAIN\$env:USERNAME" }
  $inGroup = $false
  try { $inGroup = [bool](Get-LocalGroupMember -Group 'docker-users' -ErrorAction Stop | Where-Object { $_.Name -ieq $user }) } catch {}
  if (-not $inGroup) {
    try { Add-LocalGroupMember -Group 'docker-users' -Member $user -ErrorAction Stop; $reboot = $true } catch {}
  }
  return $reboot
}

function Request-Reboot {
  Set-ItemProperty -Path $RunOnceKey -Name 'QadamixSetup' -Value "cmd.exe /c `"`"$Self`"`""
  New-Item -ItemType File -Force -Path $RebootMarker | Out-Null
  Write-Host ''
  Write-Host 'Нужна перезагрузка компьютера. После входа в Windows установка продолжится сама.' -ForegroundColor Yellow
  Read-Host 'Нажмите Enter, чтобы перезагрузить сейчас (или закройте окно и перезагрузите позже)'
  shutdown.exe /r /t 10 /c 'QADAMIX: перезагрузка для WSL и Docker'
  exit 3010
}

# ---------------------------------------------------------------- Режим «только установка» (окно администратора)
if ($env:QX_MODE -eq 'install') {
  $r = 'ok'; if (Install-Prereqs) { $r = 'reboot' }
  if ($env:QX_RESULT) { Set-Content -Path $env:QX_RESULT -Value $r }
  if ($r -eq 'reboot') { exit 3010 } else { exit 0 }
}

Write-Host 'QADAMIX — установка и запуск на Windows' -ForegroundColor White

Step 'Проверяю компьютер'
$build = [Environment]::OSVersion.Version.Build
if ($build -lt 19045) { Warn "Сборка Windows $build. Docker Desktop нужна Windows 10 22H2 (19045) или Windows 11 — обновите Windows через «Центр обновления»." }
else { Ok "Windows, сборка $build" }
try {
  $hv = (Get-CimInstance Win32_ComputerSystem).HypervisorPresent
  $vt = (Get-CimInstance Win32_Processor | Select-Object -First 1).VirtualizationFirmwareEnabled
  if ($hv -or $vt) { Ok 'Виртуализация включена' }
  else { Warn 'Виртуализация выключена в BIOS (Intel VT-x / AMD SVM). Без неё Docker не запустится — включите её в BIOS.' }
} catch {}

$missing = @()
if (-not (Has-Git))    { $missing += 'Git' }
if (-not (Has-Wsl))    { $missing += 'WSL 2' }
if (-not (Has-Docker)) { $missing += 'Docker Desktop' }

if ($missing.Count -gt 0) {
  Step ('Нужно установить: ' + ($missing -join ', '))
  if (Test-Path $RebootMarker) {
    Fail ("Компьютер ещё не перезагружен или установка не завершилась: " + ($missing -join ', ') + ". Перезагрузите компьютер и запустите файл снова.")
  }
  $needReboot = $false
  if (Is-Admin) {
    $needReboot = Install-Prereqs
  } else {
    Write-Host '    Сейчас Windows спросит разрешение на установку — нажмите «Да».'
    $resultFile = Join-Path $env:TEMP 'qadamix-setup-result.txt'
    Remove-Item $resultFile -ErrorAction SilentlyContinue
    try {
      $p = Start-Process -FilePath $Self -ArgumentList @('install', "`"$env:USERDOMAIN\$env:USERNAME`"", "`"$resultFile`"") -Verb RunAs -Wait -PassThru
    } catch { Fail 'Без прав администратора установить WSL и Docker нельзя.' }
    $r = Get-Content $resultFile -ErrorAction SilentlyContinue
    if ($r -eq 'reboot' -or $p.ExitCode -eq 3010) { $needReboot = $true }
    elseif ($r -ne 'ok') { Fail 'Установка в окне администратора не завершилась (подробности были в том окне).' }
  }
  if ($needReboot) { Request-Reboot }
  Refresh-Path
}
Ok 'Git, WSL 2 и Docker Desktop установлены'

# ---------------------------------------------------------------- Docker
Step 'Запускаю Docker Desktop'
$null = & docker info 2>&1
if ($LASTEXITCODE -ne 0) {
  Start-Process -FilePath $DockerExe
  Write-Host '    Если Docker покажет окно с условиями использования — нажмите Accept. Вход в аккаунт Docker не нужен (Skip).'
  $deadline = (Get-Date).AddMinutes(6)
  do {
    Start-Sleep -Seconds 5
    Write-Host -NoNewline '.'
    $null = & docker info 2>&1
  } while ($LASTEXITCODE -ne 0 -and (Get-Date) -lt $deadline)
  Write-Host ''
  if ($LASTEXITCODE -ne 0) { Fail 'Docker не запустился за 6 минут. Откройте Docker Desktop и посмотрите, что он пишет (часто помогает перезагрузка).' }
}
Ok 'Docker работает'

# ---------------------------------------------------------------- Проект
Step 'Получаю проект QADAMIX'
$here = Split-Path -Parent $Self
if (Test-Path (Join-Path $here 'docker-compose.yml')) {
  $Root = $here
  Ok "Проект рядом с этим файлом: $Root"
} else {
  $Root = Join-Path $env:USERPROFILE 'Qadamix-'
  if (Test-Path (Join-Path $Root '.git')) {
    & git -C $Root pull --ff-only
    Ok "Проект обновлён: $Root"
  } else {
    Write-Host '    Репозиторий приватный: если откроется окно входа GitHub — войдите в свой аккаунт.'
    & git clone $RepoUrl $Root
    if ($LASTEXITCODE -ne 0) { Fail 'Не удалось скачать проект с GitHub.' }
    Ok "Проект скачан: $Root"
  }
}
Set-Location $Root

Step 'Собираю и запускаю контейнеры (первый раз 5–10 минут)'
& docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Fail 'docker compose up завершился с ошибкой (если пишет «port is already allocated» — закройте программу, которая занимает порт 5432, 4000, 8080 или 8081).' }

Write-Host -NoNewline '    Жду API'
$deadline = (Get-Date).AddMinutes(4); $up = $false
do {
  try { $null = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 'http://localhost:4000/api/health'; $up = $true } catch { Start-Sleep -Seconds 3; Write-Host -NoNewline '.' }
} while (-not $up -and (Get-Date) -lt $deadline)
Write-Host ''
if (-not $up) { & docker compose logs --tail 40 api; Fail 'API не ответил за 4 минуты.' }
Ok 'API запущен'

# ---------------------------------------------------------------- Тесты
Step 'Запускаю сквозные проверки API'
& docker run --rm -v "${Root}\server\scripts:/s" -e API=http://host.docker.internal:4000/api node:24-alpine node /s/smoke.mjs
$testsOk = ($LASTEXITCODE -eq 0)
Write-Host '    Возвращаю демо-данные после тестов...'
& docker compose run --rm seed node src/seed.js --reset | Out-Null

Write-Host ''
if ($testsOk) { Write-Host 'Все проверки прошли.' -ForegroundColor Green }
else { Write-Host 'Часть проверок не прошла — пришлите скриншот.' -ForegroundColor Red }

Write-Host ''
Write-Host 'QADAMIX запущен:' -ForegroundColor White
Write-Host '  Кабинет логиста        http://localhost:8080'
Write-Host '  Приложение водителя    http://localhost:8081'
Write-Host '  API                    http://localhost:4000/api'
Write-Host ''
Write-Host 'Вход (код показывается на экране):'
Write-Host '  Логист     +7 701 000 00 01'
Write-Host '  Водитель   +7 701 100 00 01'
Write-Host '  Админ      +7 701 000 00 00'
Write-Host ''
Write-Host "Остановить: в папке $Root выполнить  docker compose down"
Write-Host 'Запустить снова: дважды щёлкнуть этот файл (или docker compose up -d).'

Remove-Item $RebootMarker -ErrorAction SilentlyContinue
Start-Process 'http://localhost:8080'
Start-Process 'http://localhost:8081'
Read-Host 'Нажмите Enter, чтобы закрыть'
exit 0
