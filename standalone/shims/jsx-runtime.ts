// React の自動JSXランタイムを、CDNから読み込んだ window.React で代替する
/* eslint-disable @typescript-eslint/no-explicit-any */
const R = (window as any).React;
const withKey = (props: any, key: any) => (key === undefined ? props : { ...props, key });
export const jsx = (type: any, props: any, key?: any) => R.createElement(type, withKey(props, key));
export const jsxs = jsx;
export const Fragment = R.Fragment;
