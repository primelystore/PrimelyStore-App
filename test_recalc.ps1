$headers = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6Zm9vY3d4bGNtYnVkZHdwYWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyODc4MzUsImV4cCI6MjA4Njg2MzgzNX0.N9f4p4LwstNmKoRIrXvfRlPKr6NkxGQ5gZN-R7wW3IY"
}
$body = @{
    productIds = @("fd53ea30-35c7-424a-b3bd-9a4f5b763e35")
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "https://bzfoocwxlcmbuddwpafh.supabase.co/functions/v1/recalculate-costs" -Method Post -Headers $headers -Body $body
    $jsonOutput = $result | ConvertTo-Json -Depth 10
    $jsonOutput | Out-File -FilePath "debug_output.json" -Encoding utf8
    Write-Host "Output saved to debug_output.json"
}
catch {
    Write-Host "Error:"
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "Response Body:"
        Write-Host $reader.ReadToEnd()
    }
}
