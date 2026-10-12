import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

type FigmaSiteConfiguration = {
  title?: string
  description?: string
  language?: string
  robots?: {
    index?: boolean
  }
  icons?: {
    icon?: string
  }
  openGraph?: {
    image?: string
  }
  analytics?: {
    googleAnalyticsId?: string
  }
  customScripts?: {
    headStart?: string
    headEnd?: string
    bodyStart?: string
    bodyEnd?: string
  }
  accessibility?: {
    addBypassLinks?: boolean
  }
}

const siteConfiguration: FigmaSiteConfiguration = {
  title: 'MBK Global',
  description: 'MBK Global — Web, AI and Security',
  language: 'en',
  robots: { index: true },
}

export default defineConfig(({ mode }) => {
  const emitSourcemaps = mode === 'development'

  return {
    base: process.env.FIGMA_PUBLIC_URL
      ? `${process.env.FIGMA_PUBLIC_URL}/`
      : '/',

    build: {
      sourcemap: emitSourcemaps ? 'inline' : false,
      minify: !emitSourcemaps,
    },

    plugins: [
      react(),
      tailwindcss(),
      figmaSiteConfigurationPlugin(siteConfiguration),
      figmaErrorOverlayReplay(),
      figmaReactRefreshBoundaryFallback(),
      figmaMakeKitPlugin({
        storiesGlob: '/src/**/*.stories.{ts,tsx,js,jsx}',
      }),
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    server: {
      host: process.env.FIGMA_DEV_SERVER_HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '8443'),
      strictPort: true,
      watch: {
        ignored: ['**/.figma/**'],
      },
    },

    preview: {
      host: process.env.FIGMA_DEV_SERVER_HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '8443'),
    },
  }
})

function figmaSiteConfigurationPlugin(
  config: FigmaSiteConfiguration,
): Plugin {
  function sanitize(value: string | undefined): string {
    return value?.replace(/[^a-zA-Z0-9_-]/g, '') || ''
  }

  function escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function replaceSlot(
    html: string,
    slot: string,
    content: string,
  ): string {
    return html.replace(`<!-- ${slot} -->`, content)
  }

  const title = config.title ?? 'MBK Global'
  const description = config.description ?? ''
  const language = sanitize(config.language) || 'en'
  const favicon = config.icons?.icon ?? ''
  const socialImage = config.openGraph?.image ?? ''
  const analyticsId = sanitize(config.analytics?.googleAnalyticsId)
  const headStart = config.customScripts?.headStart ?? ''
  const headEnd = config.customScripts?.headEnd ?? ''
  const bodyStart = config.customScripts?.bodyStart ?? ''
  const bodyEnd = config.customScripts?.bodyEnd ?? ''
  const robotsTxt =
    config.robots?.index === false
      ? 'User-agent: *\nDisallow: /\n'
      : ''

  return {
    name: 'figma-site-configuration',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!robotsTxt || req.url?.split('?')[0] !== '/robots.txt') {
          return next()
        }

        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(robotsTxt)
      })
    },

    generateBundle() {
      if (!robotsTxt) return

      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: robotsTxt,
      })
    },

    transformIndexHtml: {
      order: 'pre',

      handler(html) {
        let result = html

        result = replaceSlot(result, 'figma:lang', language)
        result = replaceSlot(result, 'figma:title', escapeHtml(title))
        result = replaceSlot(result, 'figma:head-start', headStart)
        result = replaceSlot(result, 'figma:head-end', headEnd)
        result = replaceSlot(result, 'figma:body-start', bodyStart)
        result = replaceSlot(result, 'figma:body-end', bodyEnd)

        const tags: HtmlTagDescriptor[] = []

        if (description) {
          tags.push({
            tag: 'meta',
            attrs: { name: 'description', content: description },
            injectTo: 'head',
          })
        }

        if (config.robots?.index === false) {
          tags.push({
            tag: 'meta',
            attrs: {
              name: 'robots',
              content: 'noindex, nofollow',
            },
            injectTo: 'head',
          })
        }

        if (favicon) {
          tags.push({
            tag: 'link',
            attrs: { rel: 'icon', href: favicon },
            injectTo: 'head',
          })
        }

        tags.push({
          tag: 'meta',
          attrs: { property: 'og:title', content: title },
          injectTo: 'head',
        })

        if (description) {
          tags.push({
            tag: 'meta',
            attrs: {
              property: 'og:description',
              content: description,
            },
            injectTo: 'head',
          })
        }

        if (socialImage) {
          tags.push(
            {
              tag: 'meta',
              attrs: { property: 'og:image', content: socialImage },
              injectTo: 'head',
            },
            {
              tag: 'meta',
              attrs: {
                name: 'twitter:card',
                content: 'summary_large_image',
              },
              injectTo: 'head',
            },
            {
              tag: 'meta',
              attrs: { name: 'twitter:image', content: socialImage },
              injectTo: 'head',
            },
          )
        }

        if (analyticsId) {
          tags.push(
            {
              tag: 'script',
              attrs: {
                async: true,
                src: `https://www.googletagmanager.com/gtag/js?id=${analyticsId}`,
              },
              injectTo: 'head',
            },
            {
              tag: 'script',
              children: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(analyticsId)});
`,
              injectTo: 'head',
            },
          )
        }

        if (config.accessibility?.addBypassLinks) {
          tags.push(
            {
              tag: 'style',
              children: `
.figma-bypass-link {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 2147483647;
  transform: translateY(-150%);
  border-radius: 6px;
  background: #111827;
  color: #fff;
  padding: 8px 12px;
  font: 600 14px/1.2 system-ui, sans-serif;
  text-decoration: none;
}
.figma-bypass-link:focus {
  transform: translateY(0);
}
`,
              injectTo: 'head',
            },
            {
              tag: 'a',
              attrs: {
                class: 'figma-bypass-link',
                href: '#root',
              },
              children: 'Skip to content',
              injectTo: 'body-prepend',
            },
          )
        }

        return { html: result, tags }
      },
    },
  }
}

function figmaErrorOverlayReplay(): Plugin {
  return {
    name: 'figma-error-overlay-replay',
    apply: 'serve',

    configureServer(server) {
      let lastError: object | null = null

      const originalSend = server.ws.send.bind(server.ws)

      server.ws.send = ((...args: any[]) => {
        const payload = args[0]

        if (payload && typeof payload === 'object') {
          const type = (payload as { type?: string }).type

          if (type === 'error') {
            lastError = payload
          } else if (type === 'update' || type === 'full-reload') {
            lastError = null
          }
        }

        return originalSend(...args)
      }) as typeof server.ws.send

      server.ws.on('connection', (socket) => {
        if (lastError) {
          socket.send(JSON.stringify(lastError))
        }
      })
    },
  }
}

function figmaReactRefreshBoundaryFallback(): Plugin {
  const boundaries = new Map<string, boolean>()
  let sendFullReload: (() => void) | null = null

  return {
    name: 'figma-react-refresh-boundary-fallback',
    apply: 'serve',
    enforce: 'post',

    configureServer(server) {
      sendFullReload = () =>
        server.ws.send({ type: 'full-reload', path: '*' })
    },

    transform(code, id) {
      if (!/\.[jt]sx?(?:\?|$)/.test(id) || id.includes('/node_modules/')) {
        return null
      }

      const moduleId = id.split('?')[0] ?? id
      const hasBoundary = code.includes('registerExportsForReactRefresh')
      const previous = boundaries.get(moduleId)

      boundaries.set(moduleId, hasBoundary)

      if (previous && !hasBoundary) {
        queueMicrotask(() => sendFullReload?.())
      }

      return null
    },
  }
}

function figmaMakeKitPlugin(options: {
  storiesGlob: string | string[]
}): Plugin {
  const storiesGlob = Array.isArray(options.storiesGlob)
    ? options.storiesGlob
    : [options.storiesGlob]

  const route = '/.figma/make/kit.html'
  const virtualId = 'virtual:figma-stories'
  const resolvedId = '\0' + virtualId
  const storiesModule =
    `export const stories = import.meta.glob(${JSON.stringify(storiesGlob)})`

  const bootstrap = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>
<div id="figma-make-kit-root"></div>
<script type="module">
  import { stories } from 'virtual:figma-stories'
  window.__FIGMA__ = Object.assign(window.__FIGMA__ ?? {}, { stories })
  window.dispatchEvent(new CustomEvent('figma.ready'))
</script>
</body>
</html>`

  return {
    name: 'figma-make-kit',
    apply: 'serve',

    resolveId(id) {
      if (id === virtualId) return resolvedId
      return null
    },

    load(id) {
      if (id === resolvedId) return storiesModule
      return null
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''

        if (url.split('?')[0] !== route) return next()

        try {
          res.setHeader('Content-Type', 'text/html')
          res.end(await server.transformIndexHtml(url, bootstrap))
        } catch (error) {
          next(error as Error)
        }
      })
    },
  }
                }
