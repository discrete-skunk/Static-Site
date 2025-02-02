const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const frontMatter = require('front-matter');

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function createExcerpt(content, length = 150) {
    // Remove HTML tags and get plain text
    const text = content.replace(/<[^>]*>/g, '');
    // Get first n characters
    return text.slice(0, length).trim() + (text.length > length ? '...' : '');
}

async function loadPartials() {
    const partials = {};
    const partialsDir = 'src/templates/partials';
    
    if (await fs.pathExists(partialsDir)) {
        const files = await fs.readdir(partialsDir);
        for (const file of files) {
            if (file.endsWith('.html')) {
                const content = await fs.readFile(path.join(partialsDir, file), 'utf-8');
                const name = path.basename(file, '.html');
                partials[name] = content;
            }
        }
    }
    
    return partials;
}

async function collectBlogPosts() {
    const posts = [];
    const blogDir = path.join('src/content/blog');
    
    if (await fs.pathExists(blogDir)) {
        const files = await fs.readdir(blogDir);
        
        for (const file of files) {
            if (file.endsWith('.md') && file !== 'index.md') {
                const content = await fs.readFile(path.join(blogDir, file), 'utf-8');
                const { attributes, body } = frontMatter(content);
                const html = marked(body);
                
                posts.push({
                    title: attributes.title,
                    date: attributes.date ? formatDate(attributes.date) : '',
                    author: attributes.author || '',
                    url: `/blog/${path.basename(file, '.md')}.html`,
                    excerpt: attributes.excerpt || createExcerpt(html)
                });
            }
        }
    }
    
    // Sort posts by date, newest first
    return posts.sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function processMarkdownFile(filePath, templates, partials, posts = []) {
    const content = await fs.readFile(filePath, 'utf-8');
    const { attributes, body } = frontMatter(content);
    const html = marked(body);
    
    // Determine which template to use
    const templateName = attributes.template || 'base.html';
    const template = templates[templateName];
    
    if (!template) {
        console.error(`Template ${templateName} not found for ${filePath}`);
        return;
    }
    
    // Replace partials first
    let page = template;
    for (const [name, partial] of Object.entries(partials)) {
        page = page.replace(`{{> ${name}}}`, partial);
    }
    
    // Format the date if it exists
    const formattedDate = attributes.date ? formatDate(attributes.date) : '';
    
    // Handle blog list template
    if (templateName === 'blog-list.html') {
        // Generate blog posts HTML
        const blogPostsHtml = posts.map(post => `
            <article class="post-card">
                <h2><a href="${post.url}">${post.title}</a></h2>
                <div class="post-meta">
                    ${post.date} by ${post.author}
                </div>
                <p>${post.excerpt}</p>
            </article>
        `).join('\n');
        
        page = page.replace('{{{blog_posts}}}', blogPostsHtml);
    }
    
    // Handle conditional metadata
    if (formattedDate) {
        page = page.replace('{{#if date}}', '').replace('{{/if}}', '');
    } else {
        page = page.replace(/{{#if date}}[\s\S]*?{{\/if}}/g, '');
    }
    
    // Then replace content and metadata
    page = page
        .replace(/{{title}}/g, attributes.title || 'Untitled')
        .replace(/{{description}}/g, attributes.description || '')
        .replace(/{{date}}/g, formattedDate)
        .replace(/{{author}}/g, attributes.author || '')
        .replace('{{content}}', html);
    
    // Calculate output path
    const relativePath = path.relative('src/content', filePath);
    const outPath = path.join('dist', relativePath.replace('.md', '.html'));
    
    // Ensure output directory exists
    await fs.ensureDir(path.dirname(outPath));
    
    // Write the file
    await fs.writeFile(outPath, page);
}

async function processDirectory(dir, templates, partials, posts) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
            await processDirectory(fullPath, templates, partials, posts);
        } else if (entry.name.endsWith('.md')) {
            await processMarkdownFile(fullPath, templates, partials, posts);
        }
    }
}

async function loadTemplates() {
    const templates = {};
    const templateDir = 'src/templates';
    const templateFiles = await fs.readdir(templateDir);
    
    for (const file of templateFiles) {
        if (file.endsWith('.html')) {
            const content = await fs.readFile(path.join(templateDir, file), 'utf-8');
            templates[file] = content;
        }
    }
    
    return templates;
}

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
    
    // Load all templates and partials
    const templates = await loadTemplates();
    const partials = await loadPartials();
    
    // Collect blog posts
    const posts = await collectBlogPosts();
    
    // Process all content
    await processDirectory('src/content', templates, partials, posts);
}

build().catch(console.error); 