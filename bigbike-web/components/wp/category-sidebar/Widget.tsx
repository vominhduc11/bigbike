export function Widget({
  title,
  extraClass,
  children,
}: {
  title: string;
  extraClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`sidebar widget toggle ${extraClass}`}>
      <div className="widget--title toggle-title">
        <h3>{title}</h3>
      </div>
      <div className="widget--body toggle-body">{children}</div>
    </div>
  );
}
