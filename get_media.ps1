try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
    
    Function Await($WinRtTask, $ResultType) {
        $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
        $netTask = $asTask.Invoke($null, @($WinRtTask))
        $netTask.Wait(1500) | Out-Null
        $netTask.Result
    }

    [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media, ContentType = WindowsRuntime] | Out-Null
    $asyncOp = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
    $mgr = Await $asyncOp ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

    $session = $mgr.GetCurrentSession()
    if ($session) {
        $props = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
        $status = $session.GetPlaybackInfo().PlaybackStatus
        [PSCustomObject]@{
            Status = $status.ToString()
            Title = $props.Title
            Artist = $props.Artist
            Album = $props.AlbumTitle
        } | ConvertTo-Json
    } else {
        [PSCustomObject]@{ Status = "Inactive"; Title = ""; Artist = ""; Album = "" } | ConvertTo-Json
    }
} catch {
    [PSCustomObject]@{ Status = "Error"; Error = $_.Exception.Message } | ConvertTo-Json
}
