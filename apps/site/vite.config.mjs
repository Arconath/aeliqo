import {defineConfig} from 'vite';
import {resolve,dirname,relative} from 'node:path';
import {readFile,copyFile} from 'node:fs/promises';
import {generatePages,generatedRoot,generatedPublic} from './generate-pages.mjs';
const root=dirname(new URL(import.meta.url).pathname);
export default defineConfig(async()=>{
 const inputs=await generatePages();
 const routes=new Set(inputs.map(path=>'/'+relative(generatedRoot,path).replace(/index\.html$/,'')));
 let outputDirectory='';
 return{root:generatedRoot,publicDir:generatedPublic,resolve:{alias:{'/src':resolve(root,'src')}},plugins:[{name:'aeliqo-static-routes',configResolved(config){outputDirectory=config.build.outDir;},configureServer(server){server.middlewares.use(async(req,res,next)=>{const path=new URL(req.url??'/', 'http://localhost').pathname;if(!path.includes('.')&&!path.startsWith('/@')&&!routes.has(path)&&!routes.has(path+'/')){res.statusCode=404;res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await server.transformIndexHtml('/404/',await readFile(resolve(generatedRoot,'404/index.html'),'utf8')));return;}next();});},async closeBundle(){if(outputDirectory==='')throw Error('Vite output directory was not resolved.');await copyFile(resolve(outputDirectory,'404/index.html'),resolve(outputDirectory,'404.html'));}}],build:{outDir:resolve(root,'dist'),emptyOutDir:true,rollupOptions:{input:inputs}},server:{host:'127.0.0.1',fs:{allow:[resolve(root,'../..')]}}};
});
