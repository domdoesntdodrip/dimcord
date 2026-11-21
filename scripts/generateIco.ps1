param(
    [string]$pngPath = "browser/icon.png",
    [string]$icoPath = "installer/icon.ico"
)

$baseDir = Split-Path -Parent $PSScriptRoot
Set-Location $baseDir

$code = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public class TrueColorIco
{
    public static void CreateIco(string pngPath, string icoPath)
    {
        byte[] rawPng = File.ReadAllBytes(pngPath);
        Image srcImg = Image.FromFile(pngPath);

        int[] dibSizes = new int[] { 128, 64, 48, 32, 16 };
        List<byte[]> imageBlobs = new List<byte[]>();
        List<int> imageSizes = new List<int>();

        imageBlobs.Add(rawPng);
        imageSizes.Add(256);

        foreach (int size in dibSizes)
        {
            Bitmap bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.SmoothingMode = SmoothingMode.HighQuality;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.CompositingQuality = CompositingQuality.HighQuality;
                g.Clear(Color.Transparent);
                g.DrawImage(srcImg, 0, 0, size, size);
            }

            byte[] dib = CreateDib32(bmp);
            imageBlobs.Add(dib);
            imageSizes.Add(size);
            bmp.Dispose();
        }
        srcImg.Dispose();

        using (FileStream fs = new FileStream(icoPath, FileMode.Create))
        using (BinaryWriter bw = new BinaryWriter(fs))
        {
            bw.Write((ushort)0);
            bw.Write((ushort)1);
            bw.Write((ushort)imageBlobs.Count);

            int offset = 6 + (16 * imageBlobs.Count);

            for (int i = 0; i < imageBlobs.Count; i++)
            {
                int sz = imageSizes[i];
                bw.Write((byte)(sz >= 256 ? 0 : sz));
                bw.Write((byte)(sz >= 256 ? 0 : sz));
                bw.Write((byte)0);
                bw.Write((byte)0);
                bw.Write((ushort)1);
                bw.Write((ushort)32);
                bw.Write((uint)imageBlobs[i].Length);
                bw.Write((uint)offset);

                offset += imageBlobs[i].Length;
            }

            for (int i = 0; i < imageBlobs.Count; i++)
            {
                bw.Write(imageBlobs[i]);
            }
        }
    }

    private static byte[] CreateDib32(Bitmap bmp)
    {
        int width = bmp.Width;
        int height = bmp.Height;

        int xorSize = width * height * 4;
        int andStride = ((width + 31) / 32) * 4;
        int andSize = andStride * height;

        int headerSize = 40;
        byte[] dib = new byte[headerSize + xorSize + andSize];

        using (MemoryStream ms = new MemoryStream(dib))
        using (BinaryWriter bw = new BinaryWriter(ms))
        {
            bw.Write((uint)40);
            bw.Write(width);
            bw.Write(height * 2);
            bw.Write((ushort)1);
            bw.Write((ushort)32);
            bw.Write((uint)0);
            bw.Write((uint)(xorSize + andSize));
            bw.Write(0);
            bw.Write(0);
            bw.Write((uint)0);
            bw.Write((uint)0);

            BitmapData data = bmp.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            byte[] rawPixels = new byte[data.Stride * height];
            Marshal.Copy(data.Scan0, rawPixels, 0, rawPixels.Length);
            bmp.UnlockBits(data);

            byte[] pixelData = new byte[xorSize];
            for (int y = 0; y < height; y++)
            {
                int srcRowOffset = (height - 1 - y) * data.Stride;
                int destRowOffset = y * width * 4;
                Array.Copy(rawPixels, srcRowOffset, pixelData, destRowOffset, width * 4);
            }
            bw.Write(pixelData);

            byte[] andMask = new byte[andSize];
            bw.Write(andMask);
        }

        return dib;
    }
}
'@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
[TrueColorIco]::CreateIco($pngPath, $icoPath)
Write-Host "Created true 32-bit DIB ICO: $icoPath"
