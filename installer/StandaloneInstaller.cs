using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;

namespace Dimcord.Installer
{
    public class DiscordInstall
    {
        public string Name { get; set; }
        public string Path { get; set; }
        public string Resources { get; set; }
        public string AppDir { get; set; }
        public string Version { get; set; }
        public bool IsPatched { get; set; }
        public bool IsCustom { get; set; }
    }

    public class App : Application
    {
        [STAThread]
        public static void Main()
        {
            App app = new App();
            app.Run(new MainWindow());
        }
    }

    public class MainWindow : Window
    {
        private List<DiscordInstall> _installs = new List<DiscordInstall>();
        private DiscordInstall _selectedInstall = null;
        private string _mode = "install"; // "install" or "uninstall"
        private bool _isBusy = false;

        private StackPanel _listPanel;
        private TextBox _logBox;
        private TextBlock _footerStatusText;
        private StackPanel _footerActionPanel;
        private Button _tabInstall;
        private Button _tabUninstall;

        // Discord Palette
        private static readonly Color ClrWindow = Color.FromRgb(0x1E, 0x1F, 0x22);
        private static readonly Color ClrTitleBar = Color.FromRgb(0x11, 0x12, 0x14);
        private static readonly Color ClrSurface = Color.FromRgb(0x2B, 0x2D, 0x31);
        private static readonly Color ClrSurfaceAlt = Color.FromRgb(0x23, 0x24, 0x28);
        private static readonly Color ClrHover = Color.FromRgb(0x35, 0x37, 0x3C);
        private static readonly Color ClrActive = Color.FromRgb(0x40, 0x42, 0x49);
        private static readonly Color ClrBorder = Color.FromArgb(0x18, 0xFF, 0xFF, 0xFF);
        private static readonly Color ClrBrand = Color.FromRgb(0x58, 0x65, 0xF2);
        private static readonly Color ClrBrandHover = Color.FromRgb(0x47, 0x52, 0xC4);
        private static readonly Color ClrGreen = Color.FromRgb(0x23, 0xA5, 0x5A);
        private static readonly Color ClrRed = Color.FromRgb(0xDA, 0x37, 0x3C);
        private static readonly Color ClrRedHover = Color.FromRgb(0xA1, 0x28, 0x2C);
        private static readonly Color ClrTextPrimary = Color.FromRgb(0xF2, 0xF3, 0xF5);
        private static readonly Color ClrTextNormal = Color.FromRgb(0xDB, 0xDE, 0xE1);
        private static readonly Color ClrTextMuted = Color.FromRgb(0x94, 0x9B, 0xA4);

        public MainWindow()
        {
            Title = "Dimcord Patcher";
            Width = 640;
            Height = 520;
            MinWidth = 580;
            MinHeight = 460;
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
            WindowStyle = WindowStyle.None;
            AllowsTransparency = false;
            Background = new SolidColorBrush(ClrWindow);
            Foreground = new SolidColorBrush(ClrTextNormal);
            FontFamily = new FontFamily("Segoe UI, Arial");

            // Extract application icon
            try
            {
                Icon = BitmapFrame.Create(Assembly.GetExecutingAssembly().GetManifestResourceStream("icon.ico"));
            }
            catch { }

            BuildUi();
            Loaded += (s, e) => RefreshInstalls();
        }

        private void BuildUi()
        {
            Grid root = new Grid();
            root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(34) }); // TitleBar
            root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(38) }); // Toolbar
            root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); // Main Body
            root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(48) }); // Footer

            // ── 1. TitleBar ──
            Grid titleBar = new Grid { Background = new SolidColorBrush(ClrTitleBar) };
            titleBar.MouseLeftButtonDown += (s, e) => { if (e.LeftButton == MouseButtonState.Pressed) DragMove(); };

            StackPanel brand = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(12, 0, 0, 0) };
            Image iconImg = new Image { Width = 18, Height = 18, Margin = new Thickness(0, 0, 8, 0) };
            try
            {
                using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("icon.ico"))
                {
                    if (stream != null)
                    {
                        IconBitmapDecoder decoder = new IconBitmapDecoder(stream, BitmapCreateOptions.None, BitmapCacheOption.Default);
                        iconImg.Source = decoder.Frames.OrderByDescending(f => f.Width).FirstOrDefault();
                    }
                }
            }
            catch { }
            brand.Children.Add(iconImg);

            TextBlock titleText = new TextBlock
            {
                Text = "Dimcord Patcher",
                FontWeight = FontWeights.SemiBold,
                FontSize = 12,
                Foreground = new SolidColorBrush(ClrTextPrimary),
                VerticalAlignment = VerticalAlignment.Center
            };
            brand.Children.Add(titleText);

            Border versionTag = new Border
            {
                Background = new SolidColorBrush(ClrSurface),
                CornerRadius = new CornerRadius(3),
                Padding = new Thickness(6, 1, 6, 1),
                Margin = new Thickness(8, 0, 0, 0),
                VerticalAlignment = VerticalAlignment.Center,
                Child = new TextBlock { Text = "v1.15.18", FontSize = 10, Foreground = new SolidColorBrush(ClrTextMuted) }
            };
            brand.Children.Add(versionTag);
            titleBar.Children.Add(brand);

            StackPanel winBtns = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
            Button btnMin = CreateWinButton("—", (s, e) => WindowState = WindowState.Minimized);
            Button btnClose = CreateWinButton("✕", (s, e) => Close(), isClose: true);
            winBtns.Children.Add(btnMin);
            winBtns.Children.Add(btnClose);
            titleBar.Children.Add(winBtns);
            Grid.SetRow(titleBar, 0);
            root.Children.Add(titleBar);

            // ── 2. Toolbar ──
            Border toolbarBorder = new Border
            {
                Background = new SolidColorBrush(ClrSurfaceAlt),
                BorderBrush = new SolidColorBrush(ClrBorder),
                BorderThickness = new Thickness(0, 0, 0, 1),
                Padding = new Thickness(14, 5, 14, 5)
            };
            Grid toolbar = new Grid();
            toolbar.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            toolbar.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            toolbar.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            // Segmented control
            Border segBorder = new Border
            {
                Background = new SolidColorBrush(ClrTitleBar),
                BorderBrush = new SolidColorBrush(ClrBorder),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(4),
                Padding = new Thickness(2)
            };
            StackPanel segPanel = new StackPanel { Orientation = Orientation.Horizontal };
            _tabInstall = CreateSegmentTab("Patch / Install", true, () => SetMode("install"));
            _tabUninstall = CreateSegmentTab("Restore Vanilla", false, () => SetMode("uninstall"));
            segPanel.Children.Add(_tabInstall);
            segPanel.Children.Add(_tabUninstall);
            segBorder.Child = segPanel;
            Grid.SetColumn(segBorder, 0);
            toolbar.Children.Add(segBorder);

            // Actions (Add Path, Rescan)
            StackPanel toolActions = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
            Button btnAddPath = CreateToolButton("+ Add Path", BrowseCustomDirectory);
            Button btnRescan = CreateToolButton("↻ Rescan", RefreshInstalls);
            toolActions.Children.Add(btnAddPath);
            toolActions.Children.Add(btnRescan);
            Grid.SetColumn(toolActions, 2);
            toolbar.Children.Add(toolActions);

            toolbarBorder.Child = toolbar;
            Grid.SetRow(toolbarBorder, 1);
            root.Children.Add(toolbarBorder);

            // ── 3. Main Body ──
            Grid mainBody = new Grid { Margin = new Thickness(14, 10, 14, 8) };
            mainBody.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            mainBody.RowDefinitions.Add(new RowDefinition { Height = new GridLength(8) });
            mainBody.RowDefinitions.Add(new RowDefinition { Height = new GridLength(100) });

            // Table
            Border tableBorder = new Border
            {
                Background = new SolidColorBrush(ClrSurface),
                BorderBrush = new SolidColorBrush(ClrBorder),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(4)
            };
            Grid tableGrid = new Grid();
            tableGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(28) });
            tableGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

            // Table Header
            Border tableHeader = new Border
            {
                Background = new SolidColorBrush(ClrSurfaceAlt),
                BorderBrush = new SolidColorBrush(ClrBorder),
                BorderThickness = new Thickness(0, 0, 0, 1),
                Padding = new Thickness(12, 0, 12, 0)
            };
            Grid headerGrid = new Grid();
            headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(180) });
            headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(90) });
            headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            headerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(100) });

            headerGrid.Children.Add(CreateHeaderCell("INSTALLATION", 0));
            headerGrid.Children.Add(CreateHeaderCell("VERSION", 1));
            headerGrid.Children.Add(CreateHeaderCell("PATH", 2));
            headerGrid.Children.Add(CreateHeaderCell("STATE", 3));
            tableHeader.Child = headerGrid;
            Grid.SetRow(tableHeader, 0);
            tableGrid.Children.Add(tableHeader);

            // Table Rows
            ScrollViewer scroll = new ScrollViewer { VerticalScrollBarVisibility = ScrollBarVisibility.Auto };
            _listPanel = new StackPanel();
            scroll.Content = _listPanel;
            Grid.SetRow(scroll, 1);
            tableGrid.Children.Add(scroll);

            tableBorder.Child = tableGrid;
            Grid.SetRow(tableBorder, 0);
            mainBody.Children.Add(tableBorder);

            // Log Console
            Border logBorder = new Border
            {
                Background = new SolidColorBrush(ClrTitleBar),
                BorderBrush = new SolidColorBrush(ClrBorder),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(4),
                Padding = new Thickness(8, 6, 8, 6)
            };
            _logBox = new TextBox
            {
                Background = Brushes.Transparent,
                Foreground = new SolidColorBrush(Color.FromRgb(0x8A, 0x8E, 0x94)),
                FontFamily = new FontFamily("Consolas, Courier New"),
                FontSize = 11,
                BorderThickness = new Thickness(0),
                IsReadOnly = true,
                TextWrapping = TextWrapping.Wrap,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto
            };
            logBorder.Child = _logBox;
            Grid.SetRow(logBorder, 2);
            mainBody.Children.Add(logBorder);

            Grid.SetRow(mainBody, 2);
            root.Children.Add(mainBody);

            // ── 4. Footer ──
            Border footerBorder = new Border
            {
                Background = new SolidColorBrush(ClrTitleBar),
                BorderBrush = new SolidColorBrush(ClrBorder),
                BorderThickness = new Thickness(0, 1, 0, 0),
                Padding = new Thickness(14, 0, 14, 0)
            };
            Grid footer = new Grid();
            footer.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            footer.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            _footerStatusText = new TextBlock
            {
                Text = "Scanning installations...",
                FontSize = 11,
                Foreground = new SolidColorBrush(ClrTextMuted),
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(_footerStatusText, 0);
            footer.Children.Add(_footerStatusText);

            _footerActionPanel = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right, VerticalAlignment = VerticalAlignment.Center };
            Grid.SetColumn(_footerActionPanel, 1);
            footer.Children.Add(_footerActionPanel);

            footerBorder.Child = footer;
            Grid.SetRow(footerBorder, 3);
            root.Children.Add(footerBorder);

            Content = root;
        }

        private TextBlock CreateHeaderCell(string text, int col)
        {
            TextBlock tb = new TextBlock
            {
                Text = text,
                FontSize = 10,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(ClrTextMuted),
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(tb, col);
            return tb;
        }

        private Button CreateWinButton(string text, RoutedEventHandler handler, bool isClose = false)
        {
            Button btn = new Button
            {
                Content = text,
                Width = 44,
                Height = 34,
                Background = Brushes.Transparent,
                Foreground = new SolidColorBrush(ClrTextMuted),
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand,
                FontSize = 12
            };
            btn.Click += handler;
            btn.MouseEnter += (s, e) => btn.Background = isClose ? new SolidColorBrush(ClrRed) : new SolidColorBrush(ClrHover);
            btn.MouseLeave += (s, e) => btn.Background = Brushes.Transparent;
            return btn;
        }

        private Button CreateSegmentTab(string text, bool active, Action onClick)
        {
            Button btn = new Button
            {
                Content = text,
                Background = active ? new SolidColorBrush(ClrSurface) : Brushes.Transparent,
                Foreground = new SolidColorBrush(active ? ClrTextPrimary : ClrTextMuted),
                BorderThickness = new Thickness(0),
                Padding = new Thickness(12, 4, 12, 4),
                Cursor = Cursors.Hand,
                FontSize = 11,
                FontWeight = FontWeights.Medium
            };
            btn.Click += (s, e) => onClick();
            return btn;
        }

        private Button CreateToolButton(string text, Action onClick)
        {
            Button btn = new Button
            {
                Content = text,
                Background = new SolidColorBrush(ClrSurface),
                Foreground = new SolidColorBrush(ClrTextNormal),
                BorderBrush = new SolidColorBrush(ClrBorder),
                BorderThickness = new Thickness(1),
                Padding = new Thickness(8, 4, 8, 4),
                Margin = new Thickness(6, 0, 0, 0),
                Cursor = Cursors.Hand,
                FontSize = 11
            };
            btn.Click += (s, e) => onClick();
            return btn;
        }

        private void SetMode(string newMode)
        {
            _mode = newMode;
            _tabInstall.Background = _mode == "install" ? new SolidColorBrush(ClrSurface) : Brushes.Transparent;
            _tabInstall.Foreground = new SolidColorBrush(_mode == "install" ? ClrTextPrimary : ClrTextMuted);
            _tabUninstall.Background = _mode == "uninstall" ? new SolidColorBrush(ClrSurface) : Brushes.Transparent;
            _tabUninstall.Foreground = new SolidColorBrush(_mode == "uninstall" ? ClrTextPrimary : ClrTextMuted);
            UpdateFooter();
        }

        private void Log(string message)
        {
            Dispatcher.Invoke(new Action(() =>
            {
                string time = DateTime.Now.ToString("HH:mm:ss");
                _logBox.AppendText("[" + time + "] " + message + "\r\n");
                _logBox.ScrollToEnd();
            }));
        }

        private void RefreshInstalls()
        {
            Log("Scanning for local Discord installations...");
            _installs = DetectDiscordInstalls();

            _listPanel.Children.Clear();
            if (_installs.Count == 0)
            {
                _listPanel.Children.Add(new TextBlock
                {
                    Text = "No Discord installations detected. Click '+ Add Path' to select manually.",
                    Foreground = new SolidColorBrush(ClrTextMuted),
                    Padding = new Thickness(20),
                    HorizontalAlignment = HorizontalAlignment.Center
                });
                _selectedInstall = null;
            }
            else
            {
                if (_selectedInstall == null || !_installs.Any(i => i.Path == _selectedInstall.Path))
                {
                    _selectedInstall = _installs[0];
                }

                foreach (var inst in _installs)
                {
                    _listPanel.Children.Add(CreateInstallRow(inst));
                }
            }

            Log("Found " + _installs.Count + " installation(s). Ready.");
            UpdateFooter();
        }

        private Border CreateInstallRow(DiscordInstall inst)
        {
            bool isSelected = _selectedInstall != null && _selectedInstall.Path == inst.Path;

            Border row = new Border
            {
                Background = new SolidColorBrush(isSelected ? ClrActive : Brushes.Transparent.Color),
                BorderBrush = new SolidColorBrush(Color.FromArgb(0x0C, 0xFF, 0xFF, 0xFF)),
                BorderThickness = new Thickness(0, 0, 0, 1),
                Padding = new Thickness(12, 8, 12, 8),
                Cursor = Cursors.Hand,
                Tag = inst
            };

            Grid g = new Grid();
            g.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(180) });
            g.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(90) });
            g.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            g.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(100) });

            // Left highlight indicator if selected
            if (isSelected)
            {
                Rectangle rect = new Rectangle { Width = 3, Fill = new SolidColorBrush(ClrBrand), HorizontalAlignment = HorizontalAlignment.Left };
                g.Children.Add(rect);
            }

            TextBlock name = new TextBlock { Text = inst.Name, FontWeight = FontWeights.SemiBold, Foreground = new SolidColorBrush(ClrTextPrimary), VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(isSelected ? 6 : 0, 0, 0, 0) };
            Grid.SetColumn(name, 0);
            g.Children.Add(name);

            TextBlock ver = new TextBlock { Text = inst.Version, FontFamily = new FontFamily("Consolas"), FontSize = 11, Foreground = new SolidColorBrush(ClrTextMuted), VerticalAlignment = VerticalAlignment.Center };
            Grid.SetColumn(ver, 1);
            g.Children.Add(ver);

            TextBlock path = new TextBlock { Text = inst.Path, FontSize = 11, Foreground = new SolidColorBrush(ClrTextMuted), VerticalAlignment = VerticalAlignment.Center, TextTrimming = TextTrimming.CharacterEllipsis, Margin = new Thickness(0, 0, 10, 0) };
            Grid.SetColumn(path, 2);
            g.Children.Add(path);

            StackPanel status = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };
            Ellipse dot = new Ellipse { Width = 7, Height = 7, Fill = new SolidColorBrush(inst.IsPatched ? ClrGreen : Color.FromRgb(0x5C, 0x5E, 0x66)), Margin = new Thickness(0, 0, 6, 0) };
            TextBlock stateText = new TextBlock { Text = inst.IsPatched ? "Patched" : "Vanilla", FontSize = 11, FontWeight = FontWeights.SemiBold, Foreground = new SolidColorBrush(inst.IsPatched ? ClrGreen : ClrTextMuted) };
            status.Children.Add(dot);
            status.Children.Add(stateText);
            Grid.SetColumn(status, 3);
            g.Children.Add(status);

            row.Child = g;
            row.MouseLeftButtonDown += (s, e) =>
            {
                _selectedInstall = inst;
                RefreshInstalls();
            };
            return row;
        }

        private void UpdateFooter()
        {
            _footerActionPanel.Children.Clear();

            if (_selectedInstall == null)
            {
                _footerStatusText.Text = "No target selected";
                return;
            }

            _footerStatusText.Text = "Target: " + _selectedInstall.Name + " (" + (_selectedInstall.IsPatched ? "Patched" : "Vanilla") + ")";

            if (_mode == "install")
            {
                if (_selectedInstall.IsPatched)
                {
                    Button btnRepair = CreateActionButton("Repair Patch", new SolidColorBrush(ClrSurface), new SolidColorBrush(ClrTextPrimary), () => RunAction(true));
                    Button btnLaunch = CreateActionButton("Launch Discord", new SolidColorBrush(ClrGreen), Brushes.White, LaunchDiscord);
                    _footerActionPanel.Children.Add(btnRepair);
                    _footerActionPanel.Children.Add(btnLaunch);
                }
                else
                {
                    Button btnPatch = CreateActionButton("Patch Discord", new SolidColorBrush(ClrBrand), Brushes.White, () => RunAction(true));
                    _footerActionPanel.Children.Add(btnPatch);
                }
            }
            else
            {
                Button btnRestore = CreateActionButton("Restore Vanilla Discord", new SolidColorBrush(ClrRed), Brushes.White, () => RunAction(false));
                btnRestore.IsEnabled = _selectedInstall.IsPatched && !_isBusy;
                _footerActionPanel.Children.Add(btnRestore);
            }
        }

        private Button CreateActionButton(string text, Brush bg, Brush fg, Action onClick)
        {
            Button btn = new Button
            {
                Content = text,
                Background = bg,
                Foreground = fg,
                Height = 32,
                Padding = new Thickness(16, 0, 16, 0),
                Margin = new Thickness(8, 0, 0, 8),
                BorderThickness = new Thickness(0),
                Cursor = Cursors.Hand,
                FontSize = 12,
                FontWeight = FontWeights.Medium,
                IsEnabled = !_isBusy
            };
            btn.Click += (s, e) => onClick();
            return btn;
        }

        private async void RunAction(bool isInstall)
        {
            if (_selectedInstall == null || _isBusy) return;
            _isBusy = true;
            UpdateFooter();

            await Task.Run(new Action(() =>
            {
                try
                {
                    if (isInstall)
                    {
                        DoInject(_selectedInstall);
                    }
                    else
                    {
                        DoUninject(_selectedInstall);
                    }
                }
                catch (Exception ex)
                {
                    Log("Error: " + ex.Message);
                }
            }));

            _isBusy = false;
            RefreshInstalls();
        }

        private bool TryInstallFromRepoSource(string permanentDir)
        {
            try
            {
                ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | (SecurityProtocolType)768 | SecurityProtocolType.Tls;

                string repo = "domdoesntdodrip/dimcord";
                string downloadUrl = null;
                string sourceLabel = null;

                Log("Checking repo for latest Dimcord release (" + repo + ")...");

                try
                {
                    using (WebClient client = new WebClient())
                    {
                        client.Headers.Add("User-Agent", "DimcordInstaller");
                        client.Headers.Add("Accept", "application/vnd.github.v3+json");
                        string json = client.DownloadString("https://api.github.com/repos/" + repo + "/releases");

                        string[] targetNames = new string[] { "desktop.zip", "payload.zip", "dimcord-desktop.zip", "dimcord.zip" };
                        foreach (string target in targetNames)
                        {
                            string pattern = "\"name\"\\s*:\\s*\"" + Regex.Escape(target) + "\"[\\s\\S]*?\"browser_download_url\"\\s*:\\s*\"(https://[^\"]+)\"";
                            Match m = Regex.Match(json, pattern, RegexOptions.IgnoreCase);
                            if (m.Success)
                            {
                                downloadUrl = m.Groups[1].Value;
                                sourceLabel = target + " (via GitHub Releases)";
                                break;
                            }
                        }
                    }
                }
                catch (Exception apiEx)
                {
                    Log("Releases API check note: " + apiEx.Message);
                }

                if (string.IsNullOrEmpty(downloadUrl))
                {
                    string[] directUrls = new string[]
                    {
                        "https://github.com/" + repo + "/releases/latest/download/desktop.zip",
                        "https://github.com/" + repo + "/releases/latest/download/payload.zip",
                        "https://github.com/" + repo + "/releases/download/prereleasev1/desktop.zip",
                        "https://github.com/" + repo + "/releases/download/prereleasev1/payload.zip",
                        "https://raw.githubusercontent.com/" + repo + "/master/dist/desktop.zip"
                    };

                    foreach (string testUrl in directUrls)
                    {
                        try
                        {
                            HttpWebRequest req = (HttpWebRequest)WebRequest.Create(testUrl);
                            req.UserAgent = "DimcordInstaller";
                            req.Method = "HEAD";
                            req.AllowAutoRedirect = true;
                            req.Timeout = 4000;
                            using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                            {
                                if (resp.StatusCode == HttpStatusCode.OK)
                                {
                                    downloadUrl = testUrl;
                                    sourceLabel = testUrl;
                                    break;
                                }
                            }
                        }
                        catch { }
                    }
                }

                if (string.IsNullOrEmpty(downloadUrl))
                {
                    Log("No online release asset found in repository. Using bundled payload.");
                    return false;
                }

                Log("Downloading latest Dimcord build from " + sourceLabel + "...");
                byte[] zipBytes = null;
                using (WebClient client = new WebClient())
                {
                    client.Headers.Add("User-Agent", "DimcordInstaller");
                    zipBytes = client.DownloadData(downloadUrl);
                }

                if (zipBytes == null || zipBytes.Length < 100)
                {
                    throw new Exception("Downloaded build archive is empty or invalid.");
                }

                Log("Downloaded " + (zipBytes.Length / 1024) + " KB. Extracting into AppData/Dimcord...");
                using (MemoryStream ms = new MemoryStream(zipBytes))
                using (ZipArchive archive = new ZipArchive(ms, ZipArchiveMode.Read))
                {
                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        string destPath = System.IO.Path.Combine(permanentDir, entry.FullName);
                        if (string.IsNullOrEmpty(entry.Name))
                        {
                            Directory.CreateDirectory(destPath);
                            continue;
                        }
                        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(destPath));
                        SafeDeleteFile(destPath);
                        entry.ExtractToFile(destPath, true);
                    }
                }

                string patcherFile = System.IO.Path.Combine(permanentDir, "patcher.js");
                if (!File.Exists(patcherFile))
                {
                    throw new Exception("Downloaded package does not contain patcher.js");
                }

                Log("Successfully installed latest Dimcord version from repo source!");
                return true;
            }
            catch (Exception ex)
            {
                Log("Could not install from online repo: " + ex.Message);
                return false;
            }
        }

        private void DoInject(DiscordInstall inst)
        {
            Log("Preparing to patch " + inst.Name + "...");
            EnsureDiscordClosed();

            // 1. Install Dimcord payload into %AppData%\Dimcord\dist\desktop
            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            string permanentDir = System.IO.Path.Combine(appData, "Dimcord", "dist", "desktop");
            Directory.CreateDirectory(permanentDir);

            bool installedFromRepo = TryInstallFromRepoSource(permanentDir);

            if (!installedFromRepo)
            {
                Log("Extracting bundled Dimcord runtime files into AppData/Dimcord...");
                using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))
                {
                    if (s != null)
                    {
                        using (ZipArchive archive = new ZipArchive(s, ZipArchiveMode.Read))
                        {
                            foreach (ZipArchiveEntry entry in archive.Entries)
                            {
                                string destPath = System.IO.Path.Combine(permanentDir, entry.FullName);
                                if (string.IsNullOrEmpty(entry.Name))
                                {
                                    Directory.CreateDirectory(destPath);
                                    continue;
                                }
                                Directory.CreateDirectory(System.IO.Path.GetDirectoryName(destPath));
                                SafeDeleteFile(destPath);
                                entry.ExtractToFile(destPath, true);
                            }
                        }
                    }
                    else
                    {
                        throw new Exception("Embedded payload resource missing.");
                    }
                }
            }

            // 2. Setup Discord app.asar
            string appAsar = System.IO.Path.Combine(inst.Resources, "app.asar");
            string backupAsar = System.IO.Path.Combine(inst.Resources, "_app.asar");

            if (!File.Exists(appAsar) && !File.Exists(backupAsar))
            {
                throw new Exception("Cannot locate app.asar in " + inst.Resources);
            }

            if (!File.Exists(backupAsar))
            {
                Log("Creating original backup: app.asar -> _app.asar");
                SafeRenameFile(appAsar, backupAsar);
            }
            else if (File.Exists(appAsar))
            {
                Log("Removing previous injection loader...");
                SafeDeleteFile(appAsar);
            }

            // 3. Write native injection asar
            Log("Generating Dimcord injection package...");
            byte[] asarBytes = GenerateInjectionAsar();
            File.WriteAllBytes(appAsar, asarBytes);

            Log("Successfully patched " + inst.Name + "! Dimcord linked.");
        }

        private void DoUninject(DiscordInstall inst)
        {
            Log("Restoring original vanilla files for " + inst.Name + "...");
            EnsureDiscordClosed();

            string appAsar = System.IO.Path.Combine(inst.Resources, "app.asar");
            string backupAsar = System.IO.Path.Combine(inst.Resources, "_app.asar");
            string appDir = System.IO.Path.Combine(inst.Resources, "app");

            if (Directory.Exists(appDir))
            {
                try { Directory.Delete(appDir, true); } catch { }
            }

            if (File.Exists(backupAsar))
            {
                if (File.Exists(appAsar))
                {
                    SafeDeleteFile(appAsar);
                }
                Log("Restoring _app.asar -> app.asar...");
                SafeRenameFile(backupAsar, appAsar);
                Log("Vanilla Discord restored for " + inst.Name + ".");
            }
            else
            {
                throw new Exception("Original _app.asar backup was not found.");
            }
        }

        private byte[] GenerateInjectionAsar()
        {
            string indexJs = "const path=require('path');const fs=require('fs');const appData=process.env.APPDATA||(process.platform==='darwin'?path.join(process.env.HOME,'Library','Application Support'):path.join(process.env.HOME,'.config'));const perm=path.join(appData,'Dimcord','dist','desktop');if(fs.existsSync(perm)){require(perm);}";
            string packageJson = "{\"name\":\"discord\",\"main\":\"index.js\"}";

            byte[] indexBytes = Encoding.UTF8.GetBytes(indexJs);
            byte[] pkgBytes = Encoding.UTF8.GetBytes(packageJson);

            string jsonHeader = string.Format(
                "{{\"files\":{{\"index.js\":{{\"size\":{0},\"offset\":\"0\"}},\"package.json\":{{\"size\":{1},\"offset\":\"{0}\"}}}}}}",
                indexBytes.Length, pkgBytes.Length
            );

            byte[] jsonBytes = Encoding.UTF8.GetBytes(jsonHeader);

            using (MemoryStream ms = new MemoryStream())
            using (BinaryWriter bw = new BinaryWriter(ms))
            {
                bw.Write((uint)4);
                bw.Write((uint)(jsonBytes.Length + 8));
                bw.Write((uint)(jsonBytes.Length + 4));
                bw.Write((uint)jsonBytes.Length);
                bw.Write(jsonBytes);
                bw.Write(indexBytes);
                bw.Write(pkgBytes);
                return ms.ToArray();
            }
        }

        private void EnsureDiscordClosed()
        {
            string[] procs = new[] { "Discord", "DiscordPTB", "DiscordCanary", "DiscordDevelopment" };
            bool hadRunning = false;

            for (int attempt = 0; attempt < 5; attempt++)
            {
                var active = Process.GetProcesses().Where(p => procs.Any(name => p.ProcessName.IndexOf(name, StringComparison.OrdinalIgnoreCase) >= 0)).ToList();
                if (active.Count == 0) break;

                if (!hadRunning)
                {
                    Log("Closing active Discord processes...");
                    hadRunning = true;
                }

                foreach (var p in active)
                {
                    try { p.Kill(); } catch { }
                }
                Thread.Sleep(800);
            }
        }

        private void SafeDeleteFile(string path, int retries = 8)
        {
            if (!File.Exists(path)) return;
            for (int i = 0; i < retries; i++)
            {
                try
                {
                    File.Delete(path);
                    return;
                }
                catch (IOException)
                {
                    EnsureDiscordClosed();
                    Thread.Sleep(600);
                }
            }
            try
            {
                string trash = path + ".trash." + Environment.TickCount;
                File.Move(path, trash);
            }
            catch (Exception ex)
            {
                throw new Exception("File is locked (" + System.IO.Path.GetFileName(path) + "). Ensure Discord is completely closed: " + ex.Message);
            }
        }

        private void SafeRenameFile(string src, string dest, int retries = 8)
        {
            for (int i = 0; i < retries; i++)
            {
                try
                {
                    File.Move(src, dest);
                    return;
                }
                catch (IOException)
                {
                    EnsureDiscordClosed();
                    Thread.Sleep(600);
                }
            }
            throw new Exception("Cannot rename " + System.IO.Path.GetFileName(src) + " -> " + System.IO.Path.GetFileName(dest) + " (file locked).");
        }

        private void LaunchDiscord()
        {
            if (_selectedInstall == null) return;
            Log("Spawning " + _selectedInstall.Name + "...");
            string updateExe = System.IO.Path.Combine(_selectedInstall.Path, "Update.exe");
            if (File.Exists(updateExe))
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = updateExe,
                    Arguments = "--processStart Discord.exe",
                    WorkingDirectory = _selectedInstall.Path
                });
            }
        }

        private void BrowseCustomDirectory()
        {
            using (var dlg = new System.Windows.Forms.FolderBrowserDialog())
            {
                dlg.Description = "Select Discord Directory";
                if (dlg.ShowDialog() == System.Windows.Forms.DialogResult.OK)
                {
                    string dir = dlg.SelectedPath;
                    string res = System.IO.Path.Combine(dir, "resources");
                    if (!Directory.Exists(res))
                    {
                        var appDirs = Directory.GetDirectories(dir, "app-*").OrderByDescending(d => d).ToList();
                        if (appDirs.Count > 0)
                        {
                            string subRes = System.IO.Path.Combine(appDirs[0], "resources");
                            if (Directory.Exists(subRes)) res = subRes;
                        }
                    }

                    if (Directory.Exists(res))
                    {
                        var custom = new DiscordInstall
                        {
                            Name = "Custom (" + System.IO.Path.GetFileName(dir) + ")",
                            Path = dir,
                            Resources = res,
                            Version = "custom",
                            IsPatched = File.Exists(System.IO.Path.Combine(res, "_app.asar")),
                            IsCustom = true
                        };
                        _installs.Add(custom);
                        _selectedInstall = custom;
                        RefreshInstalls();
                    }
                    else
                    {
                        MessageBox.Show("Could not locate a valid 'resources' directory in the chosen folder.", "Invalid Folder", MessageBoxButton.OK, MessageBoxImage.Warning);
                    }
                }
            }
        }

        private List<DiscordInstall> DetectDiscordInstalls()
        {
            var results = new List<DiscordInstall>();
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            if (string.IsNullOrEmpty(localAppData)) return results;

            var branches = new[]
            {
                new { Name = "Discord Stable", Dir = System.IO.Path.Combine(localAppData, "Discord") },
                new { Name = "Discord PTB", Dir = System.IO.Path.Combine(localAppData, "DiscordPTB") },
                new { Name = "Discord Canary", Dir = System.IO.Path.Combine(localAppData, "DiscordCanary") },
                new { Name = "Discord Development", Dir = System.IO.Path.Combine(localAppData, "DiscordDevelopment") },
            };

            foreach (var b in branches)
            {
                if (!Directory.Exists(b.Dir)) continue;
                try
                {
                    var appDirs = Directory.GetDirectories(b.Dir, "app-*").OrderByDescending(d => d).ToList();
                    if (appDirs.Count > 0)
                    {
                        string latestApp = appDirs[0];
                        string res = System.IO.Path.Combine(latestApp, "resources");
                        if (Directory.Exists(res))
                        {
                            string ver = System.IO.Path.GetFileName(latestApp).Replace("app-", "");
                            bool isPatched = File.Exists(System.IO.Path.Combine(res, "_app.asar")) || Directory.Exists(System.IO.Path.Combine(res, "app"));
                            results.Add(new DiscordInstall
                            {
                                Name = b.Name,
                                Path = b.Dir,
                                Resources = res,
                                AppDir = latestApp,
                                Version = ver,
                                IsPatched = isPatched
                            });
                        }
                    }
                }
                catch { }
            }
            return results;
        }
    }
}
