package com.anyplay.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.os.Environment;
import java.io.File;
import java.io.FileWriter;
import java.io.FileReader;
import java.io.BufferedReader;
import java.util.concurrent.ConcurrentHashMap;

import com.frostwire.jlibtorrent.SessionManager;
import com.frostwire.jlibtorrent.SessionParams;
import com.frostwire.jlibtorrent.SettingsPack;
import com.frostwire.jlibtorrent.swig.settings_pack;
import com.frostwire.jlibtorrent.TorrentHandle;
import com.frostwire.jlibtorrent.TorrentInfo;
import com.frostwire.jlibtorrent.TorrentStatus;
import com.frostwire.jlibtorrent.alerts.Alert;
import com.frostwire.jlibtorrent.AlertListener;
import android.util.Log;

import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.FFmpegSession;
import com.arthenica.ffmpegkit.ReturnCode;
import com.arthenica.ffmpegkit.Statistics;

import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "AnyPlayNative")
public class AnyPlayNativePlugin extends Plugin {

    private SessionManager sessionManager;
    private final java.util.concurrent.ConcurrentLinkedQueue<String> torrentLogs = new java.util.concurrent.ConcurrentLinkedQueue<>();

    private void addLog(String msg) {
        String time = new java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(new java.util.Date());
        torrentLogs.add("[" + time + "] " + msg);
        if (torrentLogs.size() > 500) {
            torrentLogs.poll();
        }
    }

    @Override
    public void load() {
        sessionManager = new SessionManager();
        
        SettingsPack sp = new SettingsPack();
        sp.listenInterfaces("0.0.0.0:6881,[::]:6881");
        sp.enableDht(true);
        sp.setBoolean(settings_pack.bool_types.enable_lsd.swigValue(), true);
        sp.setBoolean(settings_pack.bool_types.enable_upnp.swigValue(), true);
        sp.setBoolean(settings_pack.bool_types.enable_natpmp.swigValue(), true);

        // Enable Protocol Encryption to bypass ISP blocking/DPI
        sp.setInteger(settings_pack.int_types.in_enc_policy.swigValue(), settings_pack.enc_policy.pe_enabled.swigValue());
        sp.setInteger(settings_pack.int_types.out_enc_policy.swigValue(), settings_pack.enc_policy.pe_enabled.swigValue());
        sp.setInteger(settings_pack.int_types.allowed_enc_level.swigValue(), settings_pack.enc_level.pe_both.swigValue());
        
        sp.setString(settings_pack.string_types.dht_bootstrap_nodes.swigValue(), 
            "dht.transmissionbt.com:6881,dht.libtorrent.org:25401,router.bittorrent.com:6881,router.utorrent.com:6881");

        SessionParams params = new SessionParams(sp);
        sessionManager.start(params);
        sessionManager.listenInterfaces("0.0.0.0:0");
        sessionManager.resume();
        sessionManager.startDht();

        Log.d("AnyPlayTorrent", "DHT running = " + sessionManager.isDhtRunning());
        Log.d("AnyPlayTorrent", "DHT nodes = " + sessionManager.dhtNodes());
        Log.d("AnyPlayTorrent", "Listen endpoints = " + sessionManager.listenEndpoints());
        Log.d("AnyPlayTorrent", "Firewalled = " + sessionManager.isFirewalled());

        sessionManager.addListener(new AlertListener() {
            @Override
            public int[] types() {
                return null; // all alerts
            }

            @Override
            public void alert(Alert<?> alert) {
                String msg = alert.type() + ": " + alert.message();
                Log.d("AnyPlayTorrent", msg);
                addLog("ALERT: " + msg);
            }
        });
    }

    private final ConcurrentHashMap<String, JSObject> activeDownloads = new ConcurrentHashMap<>();

    @PluginMethod
    public void prepareDownload(PluginCall call) {
        String id = call.getString("id");
        String title = call.getString("title");
        if (id != null && title != null) {
            JSObject dl = new JSObject();
            dl.put("status", "Finding sources...");
            dl.put("progress", 0);
            dl.put("title", title);
            dl.put("logs", "[" + new java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(new java.util.Date()) + "] Queued for processing...\n");
            activeDownloads.put(id, dl);
        }
        call.resolve();
    }

    @PluginMethod
    public void setDownloadError(PluginCall call) {
        String id = call.getString("id");
        String error = call.getString("error");
        JSObject current = activeDownloads.get(id);
        if (current != null) {
            current.put("status", "error: " + error);
        }
        call.resolve();
    }

    @PluginMethod
    public void appendDownloadLog(PluginCall call) {
        String id = call.getString("id");
        String log = call.getString("log");
        JSObject current = activeDownloads.get(id);
        if (current != null && log != null) {
            String currentLogs = current.getString("logs");
            if (currentLogs == null) currentLogs = "";
            String time = new java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(new java.util.Date());
            currentLogs += "[" + time + "] " + log + "\n";
            if (currentLogs.length() > 2000) {
                currentLogs = currentLogs.substring(currentLogs.length() - 2000);
            }
            current.put("logs", currentLogs);
        }
        call.resolve();
    }

    @PluginMethod
    public void getDownloads(PluginCall call) {
        JSObject result = new JSObject();
        for (String key : activeDownloads.keySet()) {
            result.put(key, activeDownloads.get(key));
        }
        call.resolve(result);
    }

    @PluginMethod
    public void getTorrentLogs(PluginCall call) {
        JSObject result = new JSObject();
        StringBuilder sb = new StringBuilder();
        for (String log : torrentLogs) {
            sb.append(log).append("\n");
        }
        result.put("logs", sb.toString());
        call.resolve(result);
    }

    @PluginMethod
    public void startTorrent(PluginCall call) {
        String magnetUrl = call.getString("magnetUrl");
        String title = call.getString("title", "Torrent");
        String showTitle = call.getString("showTitle");
        String type = call.getString("type", "movie");
        String id = call.getString("id");

        if (magnetUrl == null || magnetUrl.trim().isEmpty() || id == null) {
            call.reject("Must provide magnetUrl and id");
            return;
        }

        File saveDir;
        if (showTitle != null && !showTitle.isEmpty()) {
            saveDir = getStorageDir(type, showTitle);
        } else {
            saveDir = getStorageDir(type, title);
        }

        if (!saveDir.exists() && !saveDir.mkdirs()) {
            call.reject("Could not create download directory");
            return;
        }

        JSObject dl = activeDownloads.get(id);
        if (dl == null) {
            dl = new JSObject();
        }
        dl.put("status", "starting");
        dl.put("progress", 0);
        dl.put("title", title);

        activeDownloads.put(id, dl);

        new Thread(() -> {
            try {
                Log.d("AnyPlayNative", "Starting torrent: " + magnetUrl);
                Log.d("AnyPlayNative", "Save directory: " + saveDir.getAbsolutePath());

                // Let jlibtorrent parse the magnet.
                com.frostwire.jlibtorrent.AddTorrentParams params = com.frostwire.jlibtorrent.AddTorrentParams.parseMagnetUri(magnetUrl);
                com.frostwire.jlibtorrent.Sha1Hash hash = params.infoHash();
                
                sessionManager.download(magnetUrl, saveDir);

                TorrentHandle handle = null;

                // async_add_torrent() means the handle may not exist immediately.
                for (int i = 0; i < 60; i++) {
                    Thread.sleep(500);

                    JSObject current = activeDownloads.get(id);
                    if (current == null) {
                        return;
                    }

                    if ("cancelled".equals(current.getString("status"))) {
                        return;
                    }

                    handle = sessionManager.find(hash);
                    if (handle != null) {
                        try {
                            handle.addTracker(new com.frostwire.jlibtorrent.AnnounceEntry("http://tracker.opentrackr.org:1337/announce"));
                            handle.addTracker(new com.frostwire.jlibtorrent.AnnounceEntry("http://tracker.openbittorrent.com:80/announce"));
                        } catch (Throwable t) {
                            Log.e("AnyPlayNative", "Failed to add trackers", t);
                        }
                        handle.resume();
                        break;
                    }
                }

                if (handle == null || !handle.isValid()) {
                    JSObject current = activeDownloads.get(id);

                    if (current != null) {
                        current.put("status", "error");
                        current.put("message", "Torrent was not added to the session");
                    }

                    Log.e("AnyPlayNative", "Torrent was not added: " + magnetUrl);
                    return;
                }

                boolean finished = false;
                int loopCount = 0;

                while (!finished) {
                    Thread.sleep(1000);
                    loopCount++;

                    if (loopCount % 10 == 0) {
                        String networkStats = "NETWORK " +
                            "DHT=" + sessionManager.isDhtRunning() +
                            " nodes=" + sessionManager.dhtNodes() +
                            " firewalled=" + sessionManager.isFirewalled() +
                            " endpoints=" + sessionManager.listenEndpoints();
                        Log.d("AnyPlayTorrent", networkStats);
                        addLog(networkStats);
                    }

                    JSObject current = activeDownloads.get(id);

                    if (current == null) {
                        return;
                    }

                    if ("cancelled".equals(current.getString("status"))) {
                        return;
                    }

                    if (!handle.isValid()) {
                        current.put("status", "error");
                        current.put("message", "Torrent handle became invalid");
                        return;
                    }

                    TorrentStatus status = handle.status();

                    float progress = status.progress() * 100f;

                    int peers = status.numPeers();
                    int seeds = status.numSeeds();
                    int connections = status.numConnections();

                    int downloadRate = status.downloadPayloadRate();
                    int uploadRate = status.uploadPayloadRate();

                    TorrentStatus.State state = status.state();

                    current.put("progress", (int) progress);
                    current.put("peers", peers);
                    current.put("seeds", seeds);
                    current.put("connections", connections);
                    current.put("downloadRate", downloadRate);
                    current.put("uploadRate", uploadRate);
                    current.put("state", state.toString());

                    String logMsg = "TORRENT state=" + state +
                        " progress=" + progress +
                        " peers=" + peers +
                        " seeds=" + seeds +
                        " connections=" + connections +
                        " down=" + downloadRate +
                        " up=" + uploadRate;
                    Log.d("AnyPlayTorrent", logMsg);
                    if (loopCount % 5 == 0) addLog(logMsg);

                    String currentLogs = current.getString("logs");
                    if (currentLogs == null) currentLogs = "";
                    currentLogs += logMsg + "\n";
                    if (currentLogs.length() > 2000) {
                        currentLogs = currentLogs.substring(currentLogs.length() - 2000);
                    }
                    current.put("logs", currentLogs);

                    if (state == TorrentStatus.State.DOWNLOADING_METADATA) {
                        current.put(
                            "status",
                            "Finding Peers (" +
                            peers +
                            " peers, " +
                            connections +
                            " connections)"
                        );
                    } else if (state == TorrentStatus.State.DOWNLOADING) {
                        current.put(
                            "status",
                            "Downloading (" +
                            (downloadRate / 1024) +
                            " KB/s)"
                        );
                    } else if (
                        state == TorrentStatus.State.FINISHED ||
                        state == TorrentStatus.State.SEEDING
                    ) {
                        current.put("status", "completed");
                        current.put("progress", 100);
                        
                        // Pause the torrent so it stops seeding and eating bandwidth
                        if (handle.isValid()) {
                            handle.pause();
                        }
                        
                        finished = true;
                    } else {
                        current.put(
                            "status",
                            state.toString().toLowerCase()
                        );
                    }
                }

            } catch (Exception e) {
                Log.e("AnyPlayNative", "Torrent failed", e);

                JSObject current = activeDownloads.get(id);

                if (current != null) {
                    current.put("status", "error");
                    current.put("message", e.getMessage() != null ? e.getMessage() : e.toString());
                }
            }
        }).start();

        call.resolve(new JSObject().put("status", "started"));
    }

    @PluginMethod
    public void downloadHLS(PluginCall call) {
        String m3u8Url = call.getString("url");
        String title = call.getString("title");
        String episodePath = call.getString("episodePath"); 
        String id = call.getString("id");

        if (m3u8Url == null || id == null) {
            call.reject("Must provide url and id");
            return;
        }

        File saveDir = getStorageDir("anime", title);
        File outputFile = new File(saveDir, episodePath);
        outputFile.getParentFile().mkdirs();

        JSObject dl = activeDownloads.get(id);
        if (dl == null) {
            dl = new JSObject();
        }
        dl.put("status", "downloading");
        dl.put("progress", 0);
        dl.put("title", title + " - " + episodePath);
        activeDownloads.put(id, dl);
        
        // We use -c copy to instantly dump the HLS stream into the container.
        // By changing the container to .mkv (in script.js), ExoPlayer will now natively support 
        // the weird HEVC/FLAC codecs that fail inside .mp4 containers!
        String cmd = String.format("-y -extension_picky 0 -user_agent \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\" -i \"%s\" -c copy \"%s\"", m3u8Url, outputFile.getAbsolutePath());
        
        FFmpegKit.executeAsync(cmd, session -> {
            ReturnCode returnCode = session.getReturnCode();
            JSObject done = activeDownloads.get(id);
            if (done != null) {
                if (ReturnCode.isSuccess(returnCode)) {
                    done.put("status", "completed");
                    done.put("progress", 100);
                } else {
                    String logs = session.getLogsAsString();
                    if (logs != null && logs.length() > 2000) {
                        logs = logs.substring(logs.length() - 2000);
                    }
                    done.put("status", "error " + returnCode.getValue() + ":\n" + logs);
                }
            }
        }, log -> {
            JSObject current = activeDownloads.get(id);
            if (current != null) {
                String currentLogs = current.getString("logs");
                if (currentLogs == null) currentLogs = "";
                currentLogs += log.getMessage() + "\n";
                if (currentLogs.length() > 2000) {
                    currentLogs = currentLogs.substring(currentLogs.length() - 2000);
                }
                current.put("logs", currentLogs);
            }
        }, statistics -> {
            JSObject current = activeDownloads.get(id);
            if (current != null) {
                int timeInSec = (int) (statistics.getTime() / 1000);
                // Since we don't know total duration, we estimate 24 mins (1440s) for progress bar
                int prog = (int)((timeInSec / 1440f) * 100);
                if (prog > 99) prog = 99;
                
                String timeStr = String.format("%02d:%02d", timeInSec / 60, timeInSec % 60);
                current.put("status", "Downloading (" + timeStr + " / ~24:00)");
                current.put("progress", prog);
            }
        });
        
        call.resolve(new JSObject().put("status", "started"));
    }

    @PluginMethod
    public void generateThumbnail(PluginCall call) {
        String videoPath = call.getString("videoPath");
        String outputPath = call.getString("outputPath");

        String cmd = String.format("-y -ss 00:02:00 -i \"%s\" -vframes 1 -q:v 2 -vf scale=w=320:h=-1 \"%s\"", videoPath, outputPath);
        FFmpegKit.executeAsync(cmd, session -> {
             // ... handling
        });
        
        call.resolve();
    }

    @PluginMethod
    public void playVideo(PluginCall call) {
        String videoPath = call.getString("videoPath");
        String subtitlePath = call.getString("subtitlePath"); 
        
        android.content.Intent intent = new android.content.Intent(getActivity(), PlayerActivity.class);
        intent.putExtra("VIDEO_URI", videoPath);
        intent.putExtra("SUBTITLE_URI", subtitlePath);
        getActivity().startActivity(intent);

        call.resolve();
    }

    @PluginMethod
    public void saveMetadata(PluginCall call) {
        String type = call.getString("type");
        String title = call.getString("title");
        JSObject metadata = call.getObject("metadata");

        File dir = getStorageDir(type, title);
        File metaFile = new File(dir, "metadata.json");

        try (FileWriter fw = new FileWriter(metaFile)) {
            fw.write(metadata.toString());
        } catch (Exception e) {
            call.reject(e.getMessage());
            return;
        }

        // Auto-download cover thumbnail in background
        String coverUrl = null;
        if (metadata.has("cover") && !metadata.isNull("cover")) {
            coverUrl = metadata.getString("cover");
        } else if (metadata.has("image") && !metadata.isNull("image")) {
            coverUrl = metadata.getString("image");
        } else if (metadata.has("image_url") && !metadata.isNull("image_url")) {
            coverUrl = metadata.getString("image_url");
        }

        if (metadata.has("base64Cover") && !metadata.isNull("base64Cover")) {
            String b64 = metadata.getString("base64Cover");
            if (b64.contains(",")) {
                b64 = b64.split(",")[1];
            }
            try {
                byte[] imageBytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
                File coverFile = new File(dir, "cover.jpg");
                java.io.FileOutputStream fos = new java.io.FileOutputStream(coverFile);
                fos.write(imageBytes);
                fos.close();
            } catch (Exception e) {
                android.util.Log.e("AnyPlayNative", "Failed to save base64 cover: " + e.getMessage());
            }
        } else if (coverUrl != null && !coverUrl.isEmpty()) {
            final String url = coverUrl;
            final File coverFile = new File(dir, "cover.jpg");
            new Thread(() -> {
                try {
                    java.net.URL imgUrl = new java.net.URL(url);
                    java.net.HttpURLConnection conn = (java.net.HttpURLConnection) imgUrl.openConnection();
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0");
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(15000);
                    conn.connect();

                    if (conn.getResponseCode() == 200) {
                        java.io.InputStream is = conn.getInputStream();
                        java.io.FileOutputStream fos = new java.io.FileOutputStream(coverFile);
                        byte[] buf = new byte[4096];
                        int len;
                        while ((len = is.read(buf)) != -1) {
                            fos.write(buf, 0, len);
                        }
                        fos.close();
                        is.close();
                    }
                    conn.disconnect();
                } catch (Exception e) {
                    android.util.Log.e("AnyPlayNative", "Failed to download cover: " + e.getMessage());
                }
            }).start();
        }

        call.resolve();
    }

    @PluginMethod
    public void deleteContent(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("Must provide path");
            return;
        }
        File file = new File(path);
        if (!file.exists()) {
            call.resolve(new JSObject().put("success", true));
            return;
        }
        boolean success = deleteRecursive(file);
        call.resolve(new JSObject().put("success", success));
    }

    private boolean deleteRecursive(File fileOrDirectory) {
        if (fileOrDirectory.isDirectory()) {
            File[] children = fileOrDirectory.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursive(child);
                }
            }
        }
        return fileOrDirectory.delete();
    }

    @PluginMethod
    public void renameContent(PluginCall call) {
        String oldPath = call.getString("oldPath");
        String newName = call.getString("newName");
        if (oldPath == null || newName == null) {
            call.reject("Must provide oldPath and newName");
            return;
        }
        File oldFile = new File(oldPath);
        if (!oldFile.exists()) {
            call.reject("File does not exist");
            return;
        }
        
        // Preserve extension if it's a file
        String ext = "";
        if (oldFile.isFile()) {
            int dotIdx = oldFile.getName().lastIndexOf(".");
            if (dotIdx > 0) {
                ext = oldFile.getName().substring(dotIdx);
            }
        }
        
        File newFile = new File(oldFile.getParentFile(), newName + ext);
        boolean success = oldFile.renameTo(newFile);
        if (success) {
            call.resolve(new JSObject().put("success", true).put("newPath", newFile.getAbsolutePath()));
        } else {
            call.reject("Rename failed");
        }
    }

    @PluginMethod
    public void clearCache(PluginCall call) {
        long freed = 0;
        try {
            java.io.File cacheDir = getContext().getCacheDir();
            freed += deleteDir(cacheDir);
            java.io.File codeCacheDir = getContext().getCodeCacheDir();
            freed += deleteDir(codeCacheDir);
            
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("success", true);
            ret.put("freedMB", freed / (1024.0 * 1024.0));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    private long deleteDir(java.io.File dir) {
        long deletedSize = 0;
        if (dir != null && dir.isDirectory()) {
            String[] children = dir.list();
            if(children != null) {
                for (int i = 0; i < children.length; i++) {
                    java.io.File child = new java.io.File(dir, children[i]);
                    if (child.isDirectory()) {
                        deletedSize += deleteDir(child);
                    } else {
                        deletedSize += child.length();
                        child.delete();
                    }
                }
            }
        }
        return deletedSize;
    }

    @PluginMethod
    public void listLibrary(PluginCall call) {
        JSObject result = new JSObject();
        JSONArray array = new JSONArray();

        File moviesDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "AnyPlay/movie");
        scanDir(moviesDir, "movie", array);
        
        File animeDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "AnyPlay/anime");
        scanDir(animeDir, "anime", array);
        
        File tvDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "AnyPlay/tv");
        scanDir(tvDir, "tv", array);

        result.put("library", array);
        call.resolve(result);
    }

    private File getStorageDir(String type, String title) {
        String safeTitle = title.replaceAll("[^a-zA-Z0-9\\-_ \\[\\]]", "").trim();
        File root = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "AnyPlay/" + type);
        File itemDir = new File(root, safeTitle);
        if (!itemDir.exists()) itemDir.mkdirs();
        return itemDir;
    }

    private void scanDir(File baseDir, String type, JSONArray array) {
        if (!baseDir.exists()) return;
        File[] items = baseDir.listFiles();
        if (items == null) return;

        for (File itemDir : items) {
            if (itemDir.isDirectory()) {
                JSONObject obj = new JSONObject();
                try {
                    obj.put("id", itemDir.getName());
                    obj.put("title", itemDir.getName());
                    obj.put("type", type);
                    obj.put("path", itemDir.getAbsolutePath());
                    
                    File meta = new File(itemDir, "metadata.json");
                    if (meta.exists()) {
                        StringBuilder sb = new StringBuilder();
                        try (BufferedReader br = new BufferedReader(new FileReader(meta))) {
                            String line;
                            while ((line = br.readLine()) != null) sb.append(line);
                        }
                        JSONObject metaJson = new JSONObject(sb.toString());
                        if (metaJson.has("title")) obj.put("title", metaJson.getString("title"));
                        obj.put("metadata", metaJson);
                    }
                    
                    File cover = new File(itemDir, "cover.jpg");
                    if (cover.exists()) {
                        obj.put("cover", com.getcapacitor.Bridge.CAPACITOR_FILE_START + cover.getAbsolutePath());
                    } else {
                        obj.put("cover", "");
                    }
                    
                    JSONArray episodes = new JSONArray();
                    scanEpisodes(itemDir, itemDir, episodes);
                    obj.put("episodes", episodes);
                    
                    array.put(obj);
                } catch (Exception e) {}
            }
        }
    }

    private void scanEpisodes(File rootDir, File currentDir, JSONArray array) {
        if (!currentDir.exists()) return;
        File[] files = currentDir.listFiles();
        if (files == null) return;

        java.util.Arrays.sort(files);

        for (File f : files) {
            if (f.isDirectory()) {
                scanEpisodes(rootDir, f, array);
            } else {
                String name = f.getName().toLowerCase();
                if (name.endsWith(".mp4") || name.endsWith(".mkv") || name.endsWith(".webm") || name.endsWith(".avi") || name.endsWith(".ts")) {
                    try {
                        JSONObject ep = new JSONObject();
                        ep.put("name", f.getName());
                        ep.put("path", f.getAbsolutePath());
                        
                        String relativePath = f.getAbsolutePath().substring(rootDir.getAbsolutePath().length() + 1);
                        ep.put("display", relativePath);
                        ep.put("size", f.length());

                        array.put(ep);
                    } catch (Exception e) {}
                }
            }
        }
    }

    @PluginMethod
    public void getStorageSpace(PluginCall call) {
        try {
            java.io.File path = android.os.Environment.getExternalStorageDirectory();
            android.os.StatFs stat = new android.os.StatFs(path.getPath());
            long blockSize = stat.getBlockSizeLong();
            long totalBlocks = stat.getBlockCountLong();
            long availableBlocks = stat.getAvailableBlocksLong();
            
            long total = totalBlocks * blockSize;
            long free = availableBlocks * blockSize;
            long used = total - free;
            
            JSObject res = new JSObject();
            res.put("total", total);
            res.put("free", free);
            res.put("used", used);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Could not read storage: " + e.getMessage());
        }
    }
}
