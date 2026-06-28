import os,sys,glob,zipfile,subprocess,requests
H=os.path.dirname(os.path.abspath(__file__)); T=os.path.join(H,'tools')
def dl(u,d):
    r=requests.get(u,stream=True,timeout=600,headers={'User-Agent':'x'});r.raise_for_status()
    open(d,'wb').write(r.content);return d
gccbin=glob.glob(os.path.join(T,'mingw64','bin','gcc.exe'))
if not gccbin:
    print('resolving winlibs asset...',flush=True)
    rel=requests.get('https://api.github.com/repos/brechtsanders/winlibs_mingw/releases',
        timeout=60,headers={'User-Agent':'x','Accept':'application/vnd.github+json'}).json()
    url=None
    for r0 in rel:
        for a in r0.get('assets',[]):
            n=a['name'].lower()
            if all(s in n for s in('x86_64','ucrt','gcc','.zip')) and 'posix' in n and 'seh' in n and 'i686' not in n:
                url=a['browser_download_url'];break
        if url:break
    if not url: print('no asset');sys.exit(1)
    print('downloading',url,flush=True)
    z=dl(url,os.path.join(T,'gcc.zip')); zipfile.ZipFile(z).extractall(T)
    gccbin=glob.glob(os.path.join(T,'mingw64','bin','gcc.exe'))
if not gccbin: print('no gcc');sys.exit(1)
gccdir=os.path.dirname(gccbin[0]); print('gcc:',gccbin[0],flush=True)
env=dict(os.environ)
env['GOROOT']=os.path.join(T,'go','go'); env['GOPATH']=os.path.join(T,'gopath')
env['GOBIN']=os.path.join(T,'gopath','bin'); env['CGO_ENABLED']='1'; env['CC']='gcc'
env['PATH']=gccdir+os.pathsep+os.path.join(env['GOROOT'],'bin')+os.pathsep+env.get('PATH','')
go=os.path.join(env['GOROOT'],'bin','go.exe')
print('building jsluice...',flush=True)
r=subprocess.run([go,'install','github.com/BishopFox/jsluice/cmd/jsluice@latest'],env=env,capture_output=True,text=True,timeout=1200)
print('rc',r.returncode); print(r.stderr[-1500:])
b=glob.glob(os.path.join(env['GOBIN'],'jsluice*'))
print('RESULT:', b if b else 'BUILD FAILED')
