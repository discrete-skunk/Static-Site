const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const frontMatter = require('front-matter');

async function build() {
    // Create dist directory
    await fs.ensureDir('dist');
    
    // Copy static assets
    await fs.copy('src/static', 'dist/static');
    
    // Copy index.html directly if it exists
    const indexPath = path.join('src', 'index.html');
    if (await fs.pathExists(indexPath)) {
        await fs.copy(indexPath, path.join('dist', 'index.html'));
    }
    
    // Read template
    const template = await fs.readFile('src/templates/base.html', 'utf-8');
    
    // Build content files
    const contentDir = 'src/content';
    const files = await fs.readdir(contentDir);
    
    for (const file of files) {
        if (file.endsWith('.md')) {
            const content = await fs.readFile(path.join(contentDir, file), 'utf-8');
            const { attributes, body } = frontMatter(content);
            const html = marked(body);
            
            // Use template for all other files
            const page = template
                .replace(/{{title}}/g, attributes.title || 'Untitled')
                .replace('{{content}}', html);
                
            const outFile = file.replace('.md', '.html');
            await fs.writeFile(path.join('dist', outFile), page);
        }
    }
}

build().catch(console.error); 