# Turns dist-demo/index.html (one self-contained page) into an artifact page body.
import re, sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src).read()
head_end = s.rfind('</head>')
body_start = s.index('<body>', head_end) + len('<body>')
body_end = s.rfind('</body>')
head, body = s[:head_end], s[body_start:body_end]
title = re.search(r"<title>.*?</title>", head).group(0)
script_start = head.index('<script type="module" crossorigin>')
script_end = head.rfind('</script>') + len('</script>')
script = head[script_start:script_end]
rest = head[:script_start] + head[script_end:]
styles = re.findall(r"<style[^>]*>.*?</style>", rest, re.S)
links = re.findall(r'<link rel="(?:preconnect|stylesheet)"[^>]*>', rest)
metas = [m for m in re.findall(r"<meta [^>]*>", rest) if 'theme-color' in m or 'color-scheme' in m or 'format-detection' in m]
out = "\n".join([title, '<meta name="claude:viewport-fit-sides" content="cover">', *metas, *links, *styles, body.strip(), script]) + "\n"
open(dst, 'w').write(out)
print('ok', len(out), 'styles', len(styles))
