# Il lavoro vero di stop.bat. Sta in un file a parte perche' la logica non
# entra in un one-liner batch senza diventare illeggibile.
#
#   -Porta N          ferma solo cio' che occupa quella porta
#   -Tutto            ferma ogni modalita' di Focus (sorgente, container)
#   -SoloContainer    ferma il container omonimo e non tocca nessun processo
param(
    [int]$Porta = 0,
    [switch]$Tutto,
    [switch]$SoloContainer
)

$ErrorActionPreference = "Continue"

# Le porte delle due modalita'. Sono diverse di proposito: cosi' il server dal
# sorgente e il container possono stare accesi insieme.
$PorteNote = @(
    @{ Nome = "sorgente";  Porta = if ($env:FOCUS_PORTA)           { [int]$env:FOCUS_PORTA }           else { 3005 } },
    @{ Nome = "container"; Porta = if ($env:FOCUS_PORTA_CONTAINER) { [int]$env:FOCUS_PORTA_CONTAINER } else { 3006 } }
)

# Processi che NON vanno mai uccisi per liberare una porta: sono il motore dei
# container o l'infrastruttura di WSL. Pubblicano la porta per conto del
# container, quindi ucciderli lascia Focus vivo e rompe tutto il resto --
# compresi i container di altri progetti sulla stessa macchina.
$Intoccabili = @("gvproxy", "win-sshproxy", "podman", "wslhost", "wslrelay",
                 "wslservice", "vmmemWSL", "com.docker.backend", "vpnkit", "dockerd")

function Porta-Libera([int]$p) {
    -not (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)
}

function Attendi-Chiusura([int]$p, [int]$Secondi) {
    for ($i = 0; $i -lt $Secondi * 2; $i++) {
        if (Porta-Libera $p) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return (Porta-Libera $p)
}

function Ferma-Container {
    if (-not (Get-Command podman -ErrorAction SilentlyContinue)) { return $false }
    if ((@(podman ps --format "{{.Names}}" 2>$null) -contains "focus") -eq $false) { return $false }
    Write-Host "[stop] fermo il container focus..."
    podman stop focus | Out-Null
    return $true
}

function Ferma-Porta([int]$p) {
    if (Porta-Libera $p) {
        Write-Host "[stop] porta $p gia' libera."
        return $true
    }

    $owners = @(Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
                Select-Object -ExpandProperty OwningProcess -Unique)

    foreach ($owner in $owners) {
        $processo = Get-Process -Id $owner -ErrorAction SilentlyContinue
        if ($processo -and $Intoccabili -contains $processo.ProcessName) {
            # La porta la pubblica il motore dei container: si ferma il
            # container per nome, mai il processo che espone la porta.
            # Si tenta comunque, anche se nessun container con questo nome
            # risulta piu' "in esecuzione": un container avviato con --rm si
            # autorimuove appena si ferma, e puo' sparire dall'elenco un
            # istante prima che la porta si liberi davvero. Per questo si
            # aspetta SEMPRE, non solo quando Ferma-Container dice di aver
            # trovato qualcosa -- altrimenti ci si arrende un attimo troppo
            # presto su un container che stava gia' spegnendosi da solo.
            $fermato = Ferma-Container
            if (Attendi-Chiusura $p 20) {
                if ($fermato) { Write-Host "[stop] container fermo, porta $p libera." }
                else { Write-Host "[stop] porta $p libera da sola (container in autorimozione)." }
                return $true
            }
            Write-Host "[stop] la porta $p e' pubblicata da $($processo.ProcessName): non lo tocco."
            return $false
        }

        # I figli per primi: restano raggiungibili per ParentProcessId anche
        # quando il padre e' gia' morto, ed e' cosi' che una porta resta
        # occupata da un processo che nessuno vede piu'.
        Get-CimInstance Win32_Process -Filter "ParentProcessId=$owner" -ErrorAction SilentlyContinue |
            ForEach-Object {
                Write-Host "[stop] chiudo il figlio $($_.ProcessId)"
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            }
        Write-Host "[stop] chiudo il processo $owner"
        Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
    }

    if (Attendi-Chiusura $p 5) { Write-Host "[stop] porta $p libera."; return $true }
    Write-Host "[stop] ATTENZIONE: la porta $p risulta ancora occupata."
    return $false
}

# --- 1. solo il container ---------------------------------------------------
if ($SoloContainer) {
    [void](Ferma-Container)
    if ($Porta -gt 0 -and -not (Attendi-Chiusura $Porta 20)) {
        Write-Host "[stop] la porta $Porta e' occupata da altro: avvio annullato."
        exit 1
    }
    exit 0
}

# --- 2. una porta sola ------------------------------------------------------
if ($Porta -gt 0 -and -not $Tutto) {
    if (Ferma-Porta $Porta) { exit 0 } else { exit 1 }
}

# --- 3. tutto Focus ----------------------------------------------------------
[void](Ferma-Container)
$esito = 0
foreach ($m in $PorteNote) {
    if (Porta-Libera $m.Porta) { continue }
    Write-Host "[stop] modalita' $($m.Nome), porta $($m.Porta)"
    if (-not (Ferma-Porta $m.Porta)) { $esito = 1 }
}
if ($esito -eq 0) { Write-Host "[stop] Focus e' spento." }
exit $esito
