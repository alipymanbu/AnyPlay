package com.anyplay.app;

import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.media3.common.MediaItem;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;
import java.io.File;

public class PlayerActivity extends AppCompatActivity {
    private PlayerView playerView;
    private ExoPlayer player;
    private String videoId;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_player);

        hideSystemUI();
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        playerView = findViewById(R.id.player_view);

        String videoUriStr = getIntent().getStringExtra("VIDEO_URI");
        if (videoUriStr == null) {
            finish();
            return;
        }
        
        // Generate a unique ID based on the path to save progress
        videoId = videoUriStr.hashCode() + "";

        Uri uri = videoUriStr.startsWith("http") ? Uri.parse(videoUriStr) : Uri.fromFile(new File(videoUriStr));
        
        player = new ExoPlayer.Builder(this).build();
        playerView.setPlayer(player);
        
        MediaItem.Builder mediaItemBuilder = new MediaItem.Builder().setUri(uri);
        
        String subUriStr = getIntent().getStringExtra("SUBTITLE_URI");
        if (subUriStr != null) {
            Uri subUri = subUriStr.startsWith("http") ? Uri.parse(subUriStr) : Uri.fromFile(new File(subUriStr));
            MediaItem.SubtitleConfiguration subtitleConfig = new MediaItem.SubtitleConfiguration.Builder(subUri)
                    .setMimeType("text/vtt") // Fallback, ExoPlayer usually infers from extension or we can set application/x-subrip for srt
                    .setLanguage("en")
                    .setSelectionFlags(androidx.media3.common.C.SELECTION_FLAG_DEFAULT)
                    .build();
            
            // For SRT files, set the proper MIME type
            if (subUriStr.toLowerCase().endsWith(".srt")) {
                subtitleConfig = new MediaItem.SubtitleConfiguration.Builder(subUri)
                        .setMimeType("application/x-subrip")
                        .setLanguage("en")
                        .setSelectionFlags(androidx.media3.common.C.SELECTION_FLAG_DEFAULT)
                        .build();
            }
            mediaItemBuilder.setSubtitleConfigurations(java.util.Collections.singletonList(subtitleConfig));
        }

        player.setMediaItem(mediaItemBuilder.build());
        
        // Restore progress
        SharedPreferences prefs = getSharedPreferences("AniFlixPlayer", MODE_PRIVATE);
        long savedPos = prefs.getLong(videoId, 0);
        if (savedPos > 0) {
            player.seekTo(savedPos);
        }

        player.prepare();
        player.play();
    }
    
    private void hideSystemUI() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (player != null) {
            player.pause();
            long currentPos = player.getCurrentPosition();
            // Save progress if played more than 10 seconds, but don't save if almost finished
            if (currentPos > 10000 && (player.getDuration() - currentPos > 10000)) {
                getSharedPreferences("AniFlixPlayer", MODE_PRIVATE)
                    .edit()
                    .putLong(videoId, currentPos)
                    .apply();
            } else if (player.getDuration() > 0 && player.getDuration() - currentPos <= 10000) {
                // Clear saved progress if finished
                getSharedPreferences("AniFlixPlayer", MODE_PRIVATE)
                    .edit()
                    .remove(videoId)
                    .apply();
            }
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (player != null) {
            player.pause();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (player != null) {
            player.release();
            player = null;
        }
    }
}
