# AnyPlay

Hey!!! It's me, ArturCaffeinated, the dev behind this project. My goal was to make an app to make my life easier.

### A lil bout me...
I'm a passionate teenage engeeneer! I looove soldering, new tech, messing with wierd OSs, building PCs, Old stuff like BASIC and retro PCs, and MODDING diffrent consoles. I have modded a few SWITCHES (Oled, lite) and loads of Gameboys.

### So... what is AnyPlay?
AnyPlay is a 100% open-source **media aggregator and watching client designed specifically for tracking and watching Anime, Movies, and TV Shows on Android**. It acts as a specialized, highly-customized web browser built on Ionic Capacitor that aggregates search results, tracking data, and media streams from publicly available sources on the internet, wrapping it all into a smooth Android expirience!

I STRONGLY suggest expiriencing it as a tech demo of how to integrate heavy native Android engines (like FFmpeg and BitTorrent) directly into a web-based UI. 

#### Technical Features:
* **Capacitor-to-Native Bridge**: Custom Java plugins allowing the frontend to talk directly to Android's OS.
* **Embedded Torrent Engine**: Uses jlibtorrent for highly optimized, peer-to-peer data fetching.
* **HLS Stream Processing**: Leverages ffmpeg-kit to process and stream .m3u8 manifests.
* **Metadata Aggregation**: Interfaces with open APIs (like AniList and TMDB) to index and display metadata dynamically.

*Note: This repository only contains the core logic (the frontend web code and the custom native Java plugin). To build the full APK, you'll need to drop these files into a fresh Capacitor Android project!*

---

### Legal & Disclaimers (The boring but important stuff!)
AnyPlay is exclusively an **advanced web search application**. It acts as a specialized web browser that aggregates search results and metadata from publicly available sources on the internet.

AnyPlay **does not host, store, stream, or distribute** any copyrighted media files. All media is provided by third-party external services and aggregators over which I have absolutely no control. Users are solely responsible for ensuring their usage complies with their local laws and regulations.

#### Open Source Credits:
* **FFmpeg (ffmpeg-kit)**: Core engine for HLS stream processing.
* **jlibtorrent (libtorrent)**: P2P downloading engine (BSD License).
* **Ionic Capacitor**: The native runtime powering the app.
* **AniList API & TMDB**: Metadata and imagery (Not endorsed or certified by TMDB).
