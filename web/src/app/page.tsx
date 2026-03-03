import { redirect } from 'next/navigation';

/**
 * 首页 - 重定向到默认 Workspace
 */
export default function Home() {
  redirect('/workspace');
}
