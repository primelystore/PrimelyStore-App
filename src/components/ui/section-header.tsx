import type { ReactNode } from "react";

interface SectionHeaderProps {
    title: string;
    description?: string;
    action?: ReactNode;
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
                {description && <p className="text-muted-foreground">{description}</p>}
            </div>
            {action && <div>{action}</div>}
        </div>
    );
}
