import {copyFile,lstat,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {basename,dirname,extname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'dist');
if(dirname(output)!==root||basename(output)!=='dist')throw Error('Invalid production output directory');
try{if((await lstat(output)).isSymbolicLink())throw Error('Production output must not be a symlink');}catch(error){if(error.code!=='ENOENT')throw error;}
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
const extensions=new Set(['.html','.js','.css','.json','.png','.jpg','.jpeg','.webp','.svg','.ico','.mp4','.webm','.ogg','.mp3','.wav','.glb','.otf','.ttf','.woff','.woff2','.pdf','.txt']);
let files=0,bytes=0;
async function copyRuntime(source,target,{island=false}={}){
  await mkdir(target,{recursive:true});
  for(const entry of await readdir(source,{withFileTypes:true})){
    if(entry.name.startsWith('.')||entry.name==='og-library'||island&&entry.name==='content')continue;
    const from=join(source,entry.name),to=join(target,entry.name);
    if(entry.isSymbolicLink())throw Error('Symlink is not a production asset: '+from);
    if(entry.isDirectory()){await copyRuntime(from,to,{island});continue;}
    if(!extensions.has(extname(entry.name).toLowerCase())||/^sources\./i.test(entry.name))continue;
    await copyFile(from,to);files++;bytes+=(await lstat(from)).size;
  }
}
await copyRuntime(join(root,'prototype/assets'),join(output,'assets'));
await copyRuntime(join(root,'prototype/island'),join(output,'island'),{island:true});
await copyFile(join(root,'prototype/favicon.ico'),join(output,'favicon.ico'));
const form=`<form name="contact" method="POST" data-netlify="true" netlify-honeypot="bot-field" hidden>
<input type="hidden" name="form-name" value="contact"><input name="bot-field"><input name="subject"><input name="name"><input type="email" name="email"><input name="project-type"><textarea name="message"></textarea></form>`;
const shell=await readFile(join(root,'prototype/island/index.html'),'utf8');
await writeFile(join(output,'index.html'),shell.replace('</head>','  <link rel="canonical" href="https://davidsvez.com/">\n</head>').replace('</body>',form+'\n</body>'));
let commit=process.env.COMMIT_REF;
if(!commit){try{commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();}catch{commit='local';}}
await writeFile(join(output,'deploy-info.json'),JSON.stringify({commit,builtAt:new Date().toISOString(),entry:'island'})+'\n');
console.log(`Production package: ${files+3} files, ${(bytes/1024/1024).toFixed(1)} MiB; island home, static routes, no source library or playtest files.`);
