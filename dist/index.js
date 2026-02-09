"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const cors_1 = require("hono/cors");
const node_server_1 = require("@hono/node-server");
const db_1 = __importDefault(require("./db"));
const bcrypt_1 = __importDefault(require("bcrypt")); // for hashing password
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken")); // for creating session tokens
const nodemailer_1 = __importDefault(require("nodemailer"));
const auth_1 = require("./auth");
const JWT_SECRET = process.env.JWT_SECRET;
const port = Number(process.env.PORT) || 3000;
// Health check route
const app = new hono_1.Hono();
//Enable CORS
app.use('*', (0, cors_1.cors)({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTION'],
    allowHeaders: ['Content-Type', 'Authorization']
}));
app.get('/', (c) => {
    return c.json({ message: 'Backend is running' });
});
// Get sent emails of logged-in user
app.get('/api/emails', async (c) => {
    try {
        const user = (0, auth_1.getUserFromToken)(c.req.header('Authorization'));
        if (!user) {
            return c.json({ success: false, message: 'Unauthorized' }, 401);
        }
        const emails = db_1.default.prepare(`
			SELECT id, subject, body, recipients, created_at
			FROM emails
			WHERE user_id = ?
			ORDER BY created_at DESC
		`).all(user.id);
        return c.json({ success: true, emails });
    }
    catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});
//Register route
app.post('/api/register', async (c) => {
    try {
        const body = await c.req.json();
        const { email, password } = body;
        if (!email || !password) {
            return c.json({ success: false, message: 'Email and password required' }, 400);
        }
        //hash the password
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        //insert into database
        const stmt = db_1.default.prepare('INSERT INTO users (email, password) VALUES (?, ?)');
        stmt.run(email, hashedPassword);
        return c.json({ success: true, message: 'User registered successfully' });
    }
    catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return c.json({ success: false, message: 'Email already exists' }, 400);
        }
        return c.json({ success: false, message: err.message }, 500);
    }
});
// Login route 
app.post('/api/login', async (c) => {
    try {
        const body = await c.req.json();
        const { email, password } = body;
        if (!email || !password) {
            return c.json({ success: false, message: 'Email and password required' }, 400);
        }
        //find user in DB 
        const stmt = db_1.default.prepare('SELECT * FROM users WHERE email = ?');
        const user = stmt.get(email);
        if (!user) {
            return c.json({ success: false, message: 'Invalid credentials' }, 401);
        }
        // compare password
        const bcrypt = require('bcrypt');
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return c.json({ success: false, message: 'Invalid credentials' }, 401);
        }
        // generate token
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
        return c.json({ success: true, token, user: { id: user.id, email: user.email } });
    }
    catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});
// send email route
app.post('/api/send-email', async (c) => {
    try {
        const user = (0, auth_1.getUserFromToken)(c.req.header('Authorization'));
        if (!user) {
            return c.json({ success: false, message: 'Unauthorized' }, 401);
        }
        const body = await c.req.json();
        const { subject, recipients, body: htmlBody } = body;
        if (!subject || !recipients || !htmlBody || !Array.isArray(recipients)) {
            return c.json({ success: false, message: 'Invalid input' }, 400);
        }
        // create a test SMTP transport using Ethereal
        let testAccount = await nodemailer_1.default.createTestAccount();
        let transporter = nodemailer_1.default.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
        // send email
        let info = await transporter.sendMail({
            from: '"Bulk Sender" <bulk@example.com',
            to: recipients.join(', '),
            subject,
            html: htmlBody
        });
        //save email in DB
        db_1.default.prepare(`
            INSERT INTO emails (user_id, subject, body, recipients)
            VALUES (?, ?, ?, ?)
            `).run(user.id, subject, htmlBody, JSON.stringify(recipients));
        console.log('Preview URL: %s', nodemailer_1.default.getTestMessageUrl(info));
        return c.json({ success: true, preview: nodemailer_1.default.getTestMessageUrl(info) });
    }
    catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});
(0, node_server_1.serve)({
    fetch: app.fetch,
    port,
});
console.log(`Server running on port ${port}`);
