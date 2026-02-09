import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export function getUserFromToken(authHeader?: string) {
	if (!authHeader) return null;

	const token = authHeader.replace('Bearer ', '');

	try {
		return jwt.verify(token, JWT_SECRET) as {
			id: number;
			email: string;
		};
	} catch {
		return null;
	}
}
