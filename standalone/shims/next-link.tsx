import { navigate } from "../router";

type Props = { href: string; className?: string; children?: React.ReactNode; title?: string };

export default function Link({ href, className, children, title }: Props) {
  return (
    <a
      href={`#${href.startsWith("/portfolio") ? "portfolio" : "simulator"}`}
      className={className}
      title={title}
      onClick={(e) => {
        e.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}
