// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

using System.Net;
using System.Net.Http.Headers;
using Cv.Server.Tests.Support;

namespace Cv.Server.Tests;

public sealed class AttachmentsTests(ServerFixture server) : IClassFixture<ServerFixture>
{
    [Fact]
    public async Task Unauthenticated_request_is_rejected()
    {
        var anon = server.Client();
        var response = await anon.GetAsync("/api/attachments");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Upload_list_download_update_and_delete_attachment()
    {
        var admin = await server.AdminAsync();
        var (user, _) = await server.UserAsync(admin, "attachuser1");

        // 1. Initial list empty
        var initialRes = await user.GetAsync("/api/attachments");
        Assert.Equal(HttpStatusCode.OK, initialRes.StatusCode);
        var initialList = await initialRes.JsonAsync();
        Assert.Empty(initialList.EnumerateArray().ToList());

        // 2. Upload sample PDF
        byte[] samplePdf = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"u8.ToArray();
        using var pdfContent = new MultipartFormDataContent();
        var filePart = new ByteArrayContent(samplePdf);
        filePart.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        pdfContent.Add(filePart, "file", "Zeugnis.pdf");
        pdfContent.Add(new StringContent("Arbeitszeugnis 2025"), "title");
        pdfContent.Add(new StringContent("Zeugnis"), "category");

        var uploadReq = new HttpRequestMessage(HttpMethod.Post, "/api/attachments") { Content = pdfContent };
        var uploadRes = await user.SendAsync(uploadReq);
        Assert.Equal(HttpStatusCode.Created, uploadRes.StatusCode);

        var uploaded = await uploadRes.JsonAsync();
        var attachmentId = uploaded.GetProperty("id").GetString()!;
        Assert.Equal("Arbeitszeugnis 2025", uploaded.GetProperty("title").GetString());
        Assert.Equal("Zeugnis.pdf", uploaded.GetProperty("fileName").GetString());
        Assert.Equal("application/pdf", uploaded.GetProperty("contentType").GetString());

        // 3. Download file
        var downloadRes = await user.GetAsync($"/api/attachments/{attachmentId}/file");
        Assert.Equal(HttpStatusCode.OK, downloadRes.StatusCode);
        Assert.Equal("application/pdf", downloadRes.Content.Headers.ContentType?.MediaType);
        var downloadedBytes = await downloadRes.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        Assert.Equal(samplePdf, downloadedBytes);

        // 4. Update title and category
        var updateRes = await user.PutAsync($"/api/attachments/{attachmentId}", new
        {
            title = "Qualifiziertes Arbeitszeugnis 2025",
            category = "Arbeitszeugnis"
        });
        Assert.Equal(HttpStatusCode.OK, updateRes.StatusCode);
        var updated = await updateRes.JsonAsync();
        Assert.Equal("Qualifiziertes Arbeitszeugnis 2025", updated.GetProperty("title").GetString());
        Assert.Equal("Arbeitszeugnis", updated.GetProperty("category").GetString());

        // 5. Delete attachment
        var deleteRes = await user.DeleteAsync($"/api/attachments/{attachmentId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteRes.StatusCode);

        // 6. After deletion: 404
        var afterDeleteRes = await user.GetAsync($"/api/attachments/{attachmentId}/file");
        Assert.Equal(HttpStatusCode.NotFound, afterDeleteRes.StatusCode);
    }

    [Fact]
    public async Task Dossier_with_attachment_renders_in_application()
    {
        var admin = await server.AdminAsync();
        var (user, _) = await server.UserAsync(admin, "attachuser2");

        // Upload a valid 1x1 PNG attachment
        byte[] pngBytes = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
        using var pngContent = new MultipartFormDataContent();
        var filePart = new ByteArrayContent(pngBytes);
        filePart.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        pngContent.Add(filePart, "file", "Zertifikat.png");
        pngContent.Add(new StringContent("Zertifikat Cloud Architect"), "title");

        var uploadReq = new HttpRequestMessage(HttpMethod.Post, "/api/attachments") { Content = pngContent };
        var uploadRes = await user.SendAsync(uploadReq);
        Assert.Equal(HttpStatusCode.Created, uploadRes.StatusCode);
        var attachment = await uploadRes.JsonAsync();
        var attachmentId = Guid.Parse(attachment.GetProperty("id").GetString()!);

        // Create application with that attachment selected
        var appRes = await user.PostAsync("/api/applications", new
        {
            jobTitle = "Lead Architect",
            company = "Cloud Corp",
            status = "draft",
            attachmentIds = new[] { attachmentId }
        });
        Assert.Equal(HttpStatusCode.Created, appRes.StatusCode);
        var app = await appRes.JsonAsync();
        var appId = app.GetProperty("id").GetString()!;
        var returnedAttachments = app.GetProperty("attachmentIds").EnumerateArray().ToList();
        Assert.Single(returnedAttachments);
        Assert.Equal(attachmentId.ToString(), returnedAttachments[0].GetString());

        // Preview dossier PDF includes attachments without error
        var previewRes = await user.GetAsync($"/api/applications/{appId}/dossier/preview");
        Assert.Equal(HttpStatusCode.OK, previewRes.StatusCode);
        Assert.Equal("application/pdf", previewRes.Content.Headers.ContentType?.MediaType);
        var pdfBytes = await previewRes.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        Assert.True(pdfBytes.Length > 100);
    }
}
