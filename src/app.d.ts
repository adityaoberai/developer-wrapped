import type { Account, Models, Storage, TablesDB } from 'node-appwrite';

type AuthContext = {
	user: Models.User<Models.Preferences>;
	account: Account;
	tablesDB: TablesDB;
	storage: Storage;
};

declare global {
	namespace App {
		interface Locals {
			/** Raw session secret from the auth cookie, if present. */
			session: string | null;
			/** Resolves the authenticated user + session-bound Appwrite services. Memoized per request; null when signed out. */
			auth: () => Promise<AuthContext | null>;
		}
	}
}

export {};
