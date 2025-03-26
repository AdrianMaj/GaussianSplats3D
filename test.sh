node --max-old-space-size=8192 util/create-ksplat.js /Volumes/External/Downloads/s021_Opole_Woijciecha_Musealna_Staromiejska_str_2025.splat /Volumes/External/Downloads/s021_Opole_Woijciecha_Musealna_Staromiejska_str_2025_1.ksplat 1 1 "0,0,0" 5.0 256 0


node --max-old-space-size=8192 util/create-ksplat.js /Volumes/External/Downloads/s021_Opole_Woijciecha_Musealna_Staromiejska_str_2025.ply /Volumes/External/Downloads/s021_Opole_Woijciecha_Musealna_Staromiejska_str_2025_1.ksplat 1 1 "0,0,0" 5.0 256 0

node --max-old-space-size=8192 util/create-ksplat.js /Volumes/External/Downloads/s021_Opole_Woijciecha_Musealna_Staromiejska_str_2025.ply /Volumes/External/Downloads/s021_Opole_Woijciecha_Musealna_Staromiejska_str_2025_sampled.ksplat 1000000 1 1 "0,0,0" 5.0 256 0

node --max-old-space-size=8192 util/create-ksplat.js  /Volumes/External/Downloads/s021_Opole_Woijciecha_Musealna_Staromiejska_str_2025.ply /Volumes/External/Downloads/s021_Opole_Woijciecha_Musealna_Staromiejska_str_2025_sampled.ksplat 23254660 0 1 "0,0,0" 5.0 256 0

node --max-old-space-size=12288 util/create-ksplat.js /Volumes/External/Downloads/s021_Opole_Woijciecha_Musealna_Staromiejska_str_2025.ply /Volumes/External/Downloads/s021_Opole_Woijciecha_Musealna_Staromiejska_str_2025_full.ksplat 0 1 "0,0,0" 5.0 256 0


python convert.py /Volumes/External/Downloads/s021_Opole_Woijciecha_Musealna_Staromiejska_str_2025.ply -o /Volumes/External/Downloads/s021_Opole_Woijciecha_Musealna_Staromiejska_str_2025.splat