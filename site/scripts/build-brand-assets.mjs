// 把 LOGO/logo.jpg 转换为站点用的 favicon 与导航栏 logo。
// 源图是白底横图，先裁掉白边取内容包围盒，再按正方形居中补白，避免 favicon 裁切掉图案。
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(here, '..');
const srcLogo = path.resolve(siteDir, '..', 'LOGO', 'logo.jpg');
const outDir = path.join(siteDir, 'static', 'img');

mkdirSync(outDir, {recursive: true});

const script = `
import sys
from PIL import Image, ImageChops

src, out_dir = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')

# 白底 -> 内容包围盒
bg = Image.new('RGB', im.size, (255, 255, 255))
bbox = ImageChops.difference(im, bg).convert('L').point(lambda v: 255 if v > 12 else 0).getbbox()
content = im.crop(bbox) if bbox else im
print('content box', bbox, content.size)

# 正方形居中补白
side = max(content.size)
square = Image.new('RGB', (side, side), (255, 255, 255))
square.paste(content, ((side - content.width) // 2, (side - content.height) // 2))

# favicon.ico 多尺寸
ico = square.resize((256, 256), Image.LANCZOS)
ico.save(
    out_dir + '/favicon.ico',
    format='ICO',
    sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)

# 导航栏 logo：透明背景 PNG，白色转 alpha
logo = square.resize((256, 256), Image.LANCZOS).convert('RGBA')
px = logo.load()
for y in range(logo.height):
    for x in range(logo.width):
        r, g, b, _ = px[x, y]
        if r > 244 and g > 244 and b > 244:
            px[x, y] = (r, g, b, 0)
logo.save(out_dir + '/logo.png')

# 标签页 PNG 图标：现代浏览器优先使用，白底不透明比透明版在标签栏更清楚
for size in (32, 192, 512):
    square.resize((size, size), Image.LANCZOS).save(f'{out_dir}/favicon-{size}.png')

# 社交卡片：保留原始横向构图
card = im.resize((1200, 750), Image.LANCZOS)
card.save(out_dir + '/social-card.jpg', quality=92)
print('written favicon.ico favicon-32/192/512.png logo.png social-card.jpg')
`;

const out = execFileSync('python', ['-c', script, srcLogo, outDir], {encoding: 'utf8'});
process.stdout.write(out);
