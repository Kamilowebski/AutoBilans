param(
    [Parameter(Mandatory = $true)]
    [string]$SigningKeystore,
    [string]$Output = "AutoBilans.apk",
    [string]$AndroidSdk = "$env:LOCALAPPDATA\Android\Sdk",
    [string]$JavaHome = $env:JAVA_HOME
)

$ErrorActionPreference = "Stop"
$Output = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Output)
$SigningKeystore = (Resolve-Path -LiteralPath $SigningKeystore).Path
if (-not $JavaHome) { throw "Set JAVA_HOME or pass -JavaHome with the JDK 21 folder." }

$tools = Join-Path $AndroidSdk "build-tools\35.0.0"
$androidJar = Join-Path $AndroidSdk "platforms\android-35\android.jar"
$java = Join-Path $JavaHome "bin\java.exe"
$javac = Join-Path $JavaHome "bin\javac.exe"
$jar = Join-Path $JavaHome "bin\jar.exe"
$aapt = Join-Path $tools "aapt2.exe"
$zipalign = Join-Path $tools "zipalign.exe"
$apksigner = Join-Path $tools "lib\apksigner.jar"
foreach ($required in @($androidJar, $java, $javac, $jar, $aapt, $zipalign, $apksigner)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Missing build tool: $required" }
}
if (Test-Path -LiteralPath $Output) { throw "Output already exists: $Output" }

function Invoke-BuildTool([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Executable failed with exit code $LASTEXITCODE" }
}

function Get-BuildDependency([string]$Url, [string]$Destination, [string]$Sha256) {
    Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Destination
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $Destination).Hash -ine $Sha256) {
        throw "Checksum mismatch: $Destination"
    }
}

$work = Join-Path ([System.IO.Path]::GetTempPath()) ("autobilans-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $work | Out-Null
Push-Location $PSScriptRoot
try {
    $classes = New-Item -ItemType Directory -Path (Join-Path $work "classes")
    $generated = New-Item -ItemType Directory -Path (Join-Path $work "generated")
    $dex = New-Item -ItemType Directory -Path (Join-Path $work "dex")
    $zxing = Join-Path $work "zxing.jar"
    $r8 = Join-Path $work "r8.jar"
    Get-BuildDependency "https://repo.maven.apache.org/maven2/com/google/zxing/core/3.5.3/core-3.5.3.jar" $zxing "8d8064c1636fdaef7189dd9055c7d59950a8940a12f2293956446ec3c109fd82"
    Get-BuildDependency "https://dl.google.com/dl/android/maven2/com/android/tools/r8/8.9.35/r8-8.9.35.jar" $r8 "204b2fc2b0f4e888dc0ef748b58090def1bf4185068d36abbb94841dbc7107a8"

    $resources = Join-Path $work "resources.zip"
    $base = Join-Path $work "base.apk"
    $classArchive = Join-Path $work "classes.jar"
    $aligned = Join-Path $work "aligned.apk"
    $signed = Join-Path $work "signed.apk"
    Invoke-BuildTool $aapt @("compile", "--dir", "res", "-o", $resources)
    Invoke-BuildTool $aapt @("link", "-I", $androidJar, "--manifest", "AndroidManifest.xml", "--java", $generated.FullName, "-A", "assets", "-o", $base, $resources)
    $sources = @(Get-ChildItem "java" -Recurse -Filter "*.java" | ForEach-Object FullName)
    $sources += Join-Path $generated.FullName "pl\autobilans\app\R.java"
    Invoke-BuildTool $javac (@("--release", "8", "-encoding", "UTF-8", "-cp", "$androidJar;$zxing", "-d", $classes.FullName) + $sources)
    Invoke-BuildTool $jar @("cf", $classArchive, "-C", $classes.FullName, ".")
    Invoke-BuildTool $java @("-cp", $r8, "com.android.tools.r8.D8", "--min-api", "26", "--lib", $androidJar, "--output", $dex.FullName, $classArchive, $zxing)
    Invoke-BuildTool $jar @("--update", "--no-manifest", "--file", $base, "-C", $dex.FullName, "classes.dex")
    Invoke-BuildTool $zipalign @("-f", "4", $base, $aligned)
    Invoke-BuildTool $java @("-jar", $apksigner, "sign", "--v4-signing-enabled", "false", "--ks", $SigningKeystore, "--out", $signed, $aligned)
    Invoke-BuildTool $java @("-jar", $apksigner, "verify", "--verbose", $signed)
    Copy-Item -LiteralPath $signed -Destination $Output
    Write-Host "APK: $Output"
} finally {
    Pop-Location
    Remove-Item -LiteralPath $work -Recurse -Force
}
