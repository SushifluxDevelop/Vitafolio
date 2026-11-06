// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

using Cv.Server.Ai;
using Cv.Server.Auth;
using Cv.Server.Errors;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Cv.Server.Controllers;

[ApiController]
[Route("api/ai")]
[Authorize]
public sealed class AiController(AiService ai) : ControllerBase
{
    private Guid CurrentUserId => User.RequiredUserId();

    [HttpGet("config")]
    public async Task<ActionResult<AiConfigDto>> GetConfig(CancellationToken ct)
    {
        var config = await ai.GetConfigAsync(CurrentUserId, ct);
        return Ok(config);
    }

    [HttpPut("config")]
    public async Task<ActionResult<AiConfigDto>> SaveConfig([FromBody] UpdateAiConfigRequest req, CancellationToken ct)
    {
        var updated = await ai.SaveConfigAsync(CurrentUserId, req, ct);
        return Ok(updated);
    }

    [HttpPost("test-connection")]
    public async Task<ActionResult<TestAiConnectionResponse>> TestConnection(CancellationToken ct)
    {
        var result = await ai.TestConnectionAsync(CurrentUserId, ct);
        return Ok(result);
    }

    [HttpPost("prompt")]
    public async Task<ActionResult<AiPromptResponse>> BuildPrompt([FromBody] AiPromptRequest req, CancellationToken ct)
    {
        var response = await ai.BuildPromptAsync(CurrentUserId, req, ct);
        return Ok(response);
    }

    [HttpPost("parse")]
    public async Task<ActionResult<object>> ParseResponse([FromBody] AiParseRequest req, CancellationToken ct)
    {
        var parsed = await ai.ParseResponseAsync(CurrentUserId, req, ct);
        return Ok(parsed);
    }

    [HttpPost("generate")]
    public async Task<ActionResult<object>> Generate([FromBody] AiGenerateRequest req, CancellationToken ct)
    {
        var generated = await ai.GenerateAsync(CurrentUserId, req, ct);
        return Ok(generated);
    }

    [HttpGet("admin-config")]
    [Authorize(Policy = AuthConstants.AdminPolicy)]
    public async Task<ActionResult<AdminServerAiConfigDto>> GetAdminConfig(CancellationToken ct)
    {
        var cfg = await ai.GetAdminServerConfigAsync(ct);
        return Ok(cfg);
    }

    [HttpPut("admin-config")]
    [Authorize(Policy = AuthConstants.AdminPolicy)]
    public async Task<ActionResult<AdminServerAiConfigDto>> SaveAdminConfig([FromBody] UpdateAdminServerAiConfigRequest req, CancellationToken ct)
    {
        var updated = await ai.SaveAdminServerConfigAsync(req, ct);
        return Ok(updated);
    }
}
