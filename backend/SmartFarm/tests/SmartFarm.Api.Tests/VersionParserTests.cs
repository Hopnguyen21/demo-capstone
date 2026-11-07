using SmartFarm.Application.Common.Exceptions;
using SmartFarm.Infrastructure.Ai.Knowledge;
using Xunit;

namespace SmartFarm.Api.Tests;

public class VersionParserTests
{
    [Theory]
    [InlineData("V1.0", "V1.1")]
    [InlineData("1.0", "V1.1")]
    [InlineData("v2", "V2.1")]
    [InlineData("Version 3.9", "V3.10")]
    [InlineData("VER 4.15", "V4.16")]
    [InlineData("1.2.3", "V1.2.4")]
    [InlineData("V2.1.9", "V2.1.10")]
    [InlineData("", "V1.1")]
    [InlineData(null, "V1.1")]
    [InlineData("   ", "V1.1")]
    public void BumpMinor_FormatsCorrectly(string? input, string expected)
    {
        var result = VersionParser.BumpMinor(input);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("V1.0", "V2.0")]
    [InlineData("1.5", "V2.0")]
    [InlineData("Version 3.9", "V4.0")]
    [InlineData("1.2.3", "V2.0")]
    [InlineData("", "V2.0")]
    [InlineData(null, "V2.0")]
    public void BumpMajor_FormatsCorrectly(string? input, string expected)
    {
        var result = VersionParser.BumpMajor(input);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("1", true)]
    [InlineData("1.0", true)]
    [InlineData("1.2", true)]
    [InlineData("1.2.3", true)]
    [InlineData("V1.0", true)]
    [InlineData("v2", true)]
    [InlineData("Version 1.2", true)]
    [InlineData("ver 3.4.5", true)]
    [InlineData("1.2garbage", false)]
    [InlineData("1.2-beta", false)]
    [InlineData("v", false)]
    [InlineData("-1", false)]
    [InlineData("-1.2", false)]
    [InlineData("1.2.3.4", false)]
    [InlineData("1.2.3.4.5", false)]
    [InlineData("", false)]
    [InlineData("   ", false)]
    [InlineData(null, false)]
    [InlineData("999999999999999999999999999999999", false)]
    [InlineData("InvalidVersionStringWithoutAnyNumber", false)]
    public void IsValidUserVersion_DetectsValidity(string? input, bool expected)
    {
        var result = VersionParser.IsValidUserVersion(input);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("1", "V1.0")]
    [InlineData("1.2", "V1.2")]
    [InlineData("1.2.3", "V1.2.3")]
    [InlineData("v2.5", "V2.5")]
    [InlineData("Version 3.4.5", "V3.4.5")]
    public void NormalizeOrBump_ValidUserVersion_PreservesNormalized(string requested, string expected)
    {
        var normalized = VersionParser.NormalizeOrBump("V1.0", requested);
        Assert.Equal(expected, normalized);
    }

    [Fact]
    public void NormalizeOrBump_EmptyRequested_BumpsMinor()
    {
        var bumped = VersionParser.NormalizeOrBump("V1.2", null);
        Assert.Equal("V1.3", bumped);
    }

    [Theory]
    [InlineData("1.2garbage")]
    [InlineData("1.2-beta")]
    [InlineData("Draft-1.0")]
    [InlineData("InvalidAlphaBetaVersion")]
    [InlineData("-1.0")]
    [InlineData("1.2.3.4")]
    [InlineData("999999999999999999999999999999999")]
    public void NormalizeOrBump_InvalidRequested_ThrowsRequestValidationException(string invalid)
    {
        Assert.Throws<RequestValidationException>(() =>
            VersionParser.NormalizeOrBump("V1.0", invalid));
    }

    [Fact]
    public void NormalizeOrBump_OverlyLongVersion_ThrowsRequestValidationException()
    {
        var longVersion = new string('1', 35);
        Assert.Throws<RequestValidationException>(() =>
            VersionParser.NormalizeOrBump("V1.0", longVersion));
    }
}
