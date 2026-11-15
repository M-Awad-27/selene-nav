"""
ALRAKIS // SELENE-NAV - 30-Second Mission Demo Video Generator
Concatenates, speed-ramps, and renders the 5 high-density mission segments
into a crisp 1080p 30fps H.264 video.
"""

import os
import sys
import subprocess
import imageio_ffmpeg
import av

def main():
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    input_file = "20261115-0831-24.4976631.mp4"
    if not os.path.exists(input_file):
        input_file = os.path.join("Video", "20261115-0831-24.4976631.mp4")
    if not os.path.exists(input_file):
        input_file = os.path.join("Video", "Recording 2026-11-15 134636.mp4")
    
    output_file = "SELENE_NAV_30s_Demo.mp4"
    print(f"[1/4] Found input video: {input_file}")
    print(f"[2/4] FFmpeg binary: {ffmpeg_exe}")

    # Build filter_complex string
    # Segments:
    # 1. 00:02 to 00:14 (12s @ 1.5x = 8.0s)
    # 2. 00:23 to 00:26 (3s @ 1.0x = 3.0s)
    # 3. 00:30 to 00:46 (16s @ 2.0x = 8.0s)
    # 4. 00:50 to 01:02 (12s @ 2.0x = 6.0s)
    # 5. 01:04 to 01:14 (10s @ 2.0x = 5.0s)
    # Total duration: 30.0s exactly.

    filter_complex = (
        "[0:v]trim=start=2.0:end=14.0,setpts=PTS-STARTPTS,setpts=PTS/1.5,fps=30,scale=1920:1080:flags=lanczos[v0];"
        "[0:v]trim=start=23.0:end=26.0,setpts=PTS-STARTPTS,setpts=PTS/1.0,fps=30,scale=1920:1080:flags=lanczos[v1];"
        "[0:v]trim=start=30.0:end=46.0,setpts=PTS-STARTPTS,setpts=PTS/2.0,fps=30,scale=1920:1080:flags=lanczos[v2];"
        "[0:v]trim=start=50.0:end=62.0,setpts=PTS-STARTPTS,setpts=PTS/2.0,fps=30,scale=1920:1080:flags=lanczos[v3];"
        "[0:v]trim=start=64.0:end=74.0,setpts=PTS-STARTPTS,setpts=PTS/2.0,fps=30,scale=1920:1080:flags=lanczos[v4];"
        "[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[vout]"
    )

    cmd = [
        ffmpeg_exe,
        "-y",
        "-i", input_file,
        "-filter_complex", filter_complex,
        "-map", "[vout]",
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", "16",
        "-pix_fmt", "yuv420p",
        "-r", "30",
        "-movflags", "+faststart",
        output_file
    ]

    print("[3/4] Running FFmpeg rendering pipeline...")
    process = subprocess.run(cmd, capture_output=True, text=True)
    if process.returncode != 0:
        print("FFmpeg Error:")
        print(process.stderr)
        sys.exit(1)

    print(f"[4/4] Output successfully rendered to: {output_file}")

    # Verify output metrics
    container = av.open(output_file)
    stream = container.streams.video[0]
    duration = float(stream.duration * stream.time_base)
    frames = stream.frames
    width = stream.width
    height = stream.height
    fps = float(stream.average_rate)
    file_size_mb = os.path.getsize(output_file) / (1024 * 1024)

    print("\n" + "="*50)
    print("VERIFICATION RESULTS:")
    print(f"  File: {output_file}")
    print(f"  Duration: {duration:.3f} s (Target: 30.0 s)")
    print(f"  Frames: {frames} (Target: 900 frames @ 30 fps)")
    print(f"  Resolution: {width}x{height} (Target: 1920x1080)")
    print(f"  Frame Rate: {fps} fps")
    print(f"  Codec: H.264 (yuv420p)")
    print(f"  File Size: {file_size_mb:.2f} MB")
    print("="*50)

if __name__ == "__main__":
    main()
