import { Profile } from "../types";
const KEY="cyclops.profile";
export async function loadProfile():Promise<Profile>{const r=await chrome.storage.local.get(KEY);return (r[KEY] as Profile|undefined)||{};}
export async function saveProfile(profile:Profile):Promise<void>{await chrome.storage.local.set({[KEY]:profile});}