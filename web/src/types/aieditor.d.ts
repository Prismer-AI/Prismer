/**
 * AiEditor 类型声明
 * 
 * 解决 aieditor CSS 模块导入的 TypeScript 类型检查问题
 */

declare module 'aieditor/dist/style.css' {
  const content: string;
  export default content;
}
