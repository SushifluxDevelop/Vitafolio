namespace Cv.Server.Tests;

/// <summary>The data folder check says what is really wrong (file instead of folder, no access, other I/O problem) and shows the container hint only where it applies.</summary>
public sealed class DataFolderTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "cv-datafolder-" + Guid.NewGuid().ToString("N"));

    public DataFolderTests() => Directory.CreateDirectory(_root);

    public void Dispose() => Directory.Delete(_root, recursive: true);

    [Fact]
    public void A_file_instead_of_a_folder_is_named_as_such()
    {
        var file = Path.Combine(_root, "afile.txt");
        File.WriteAllText(file, "x");

        var ex = Assert.Throws<InvalidOperationException>(() => ServerApp.EnsureWritable(file, desktop: true, inContainer: false));

        Assert.Equal($"Der Datenordner '{file}' ist eine Datei und kein Ordner. Bitte die Einstellung für den Datenordner (DATA_DIR) prüfen.", ex.Message);
        Assert.DoesNotContain("Schreibzugriff", ex.Message);
    }

    [Fact]
    public void A_writable_folder_is_created_and_accepted()
    {
        var folder = Path.Combine(_root, "new", "data");

        ServerApp.EnsureWritable(folder, desktop: false, inContainer: false);

        Assert.True(Directory.Exists(folder));
        Assert.Empty(Directory.GetFiles(folder));
    }

    [Theory]
    [InlineData(false, true, true)]
    [InlineData(false, false, false)]
    [InlineData(true, true, false)]
    [InlineData(true, false, false)]
    public void Denied_access_gets_the_container_hint_only_for_the_server_in_a_container(bool desktop, bool inContainer, bool expectContainerHint)
    {
        var text = ServerApp.DescribeDataFolderProblem(new UnauthorizedAccessException("denied"), "/data", desktop, inContainer);

        Assert.StartsWith("Kein Schreibzugriff auf den Datenordner '/data'.", text);
        Assert.Equal(expectContainerHint, text.Contains("PUID/PGID", StringComparison.Ordinal));
        if (!expectContainerHint) Assert.Contains("Berechtigungen", text);
    }

    [Fact]
    public void Other_io_problems_keep_their_original_text()
    {
        var text = ServerApp.DescribeDataFolderProblem(new IOException("Das Laufwerk ist nicht bereit."), "/data/x", desktop: true, inContainer: false);

        Assert.Equal("Der Datenordner '/data/x' ist nicht benutzbar: Das Laufwerk ist nicht bereit.", text);
    }
}
