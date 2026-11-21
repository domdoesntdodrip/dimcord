using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace Dimcord
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                Directory.SetCurrentDirectory(baseDir);

                string distDesktop = Path.Combine(baseDir, "dist", "desktop", "patcher.js");
                string electronExe = Path.Combine(baseDir, "node_modules", "electron", "dist", "electron.exe");
                string mainJs = Path.Combine(baseDir, "installer", "gui", "main.js");

                // Check if build is needed
                if (!File.Exists(distDesktop))
                {
                    ProcessStartInfo buildPsi = new ProcessStartInfo
                    {
                        FileName = "cmd.exe",
                        Arguments = "/c pnpm build",
                        WorkingDirectory = baseDir,
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        WindowStyle = ProcessWindowStyle.Hidden
                    };
                    using (Process p = Process.Start(buildPsi))
                    {
                        p.WaitForExit();
                    }
                }

                // Launch GUI
                if (File.Exists(electronExe) && File.Exists(mainJs))
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = electronExe,
                        Arguments = "\"" + mainJs + "\"",
                        WorkingDirectory = baseDir,
                        UseShellExecute = false
                    };
                    Process.Start(psi);
                }
                else
                {
                    // Fallback to cmd npx electron
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = "cmd.exe",
                        Arguments = "/c npx electron \"" + mainJs + "\"",
                        WorkingDirectory = baseDir,
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        WindowStyle = ProcessWindowStyle.Hidden
                    };
                    Process.Start(psi);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Failed to launch Dimcord Installer:\n" + ex.Message, "Dimcord Installer Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
