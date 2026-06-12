import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { Hono } from 'hono'
import authRoutes from './routes/auth'
import projectApp from './routes/projects'
import apartmentApp from './routes/apartments'
import userApp from './routes/users'
import postApp from './routes/posts'
import settingApp from './routes/settings'
import adminStatsApp from './routes/admin'
import notifyApp from './routes/notifications'
import heroslideApp from './routes/heroslide'
import bankApp from './routes/banks'
import { serveStatic } from '@hono/node-server/serve-static'

const app = new Hono()

app.use(cors({
  origin: ['http://localhost:4321', 'http://localhost:4321'], // Port của Astro
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use('/api/*', cors({
  origin: 'http://localhost:4321', // Frontend của bạn
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // Bắt buộc phải có PATCH
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposeHeaders: ['Content-Length', 'X-Kuma-Revision'],
  maxAge: 600,
  credentials: true,
}));

projectApp.use('*', cors({
  origin: 'http://localhost:4321', // Domain của Frontend Astro
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.route('/api/auth', authRoutes) 
app.route('/api/projects', projectApp)
app.route('/api/apartments', apartmentApp)
app.route('/api/users', userApp)
app.route('/api/posts', postApp)
app.route('/api/settings', settingApp)
app.route('/api/admin', adminStatsApp)
app.route('/api/notifications', notifyApp)
app.route('/api/heroslides', heroslideApp)
app.route('/api/banks', bankApp)

// Thêm dòng này TRƯỚC các route api
app.use('/uploads/*', serveStatic({ root: './public' }))

app.get('/', (c) => c.text('Hono is running!'))

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
