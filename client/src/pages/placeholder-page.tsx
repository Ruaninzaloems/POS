import React from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <PosLayout>
      <div className="flex-1 min-h-0 p-4 sm:p-8 flex items-center justify-center bg-[#F2F4F7] overflow-y-auto">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto bg-[var(--pos-accent-tint)] p-4 rounded-full mb-4">
              <Construction className="h-8 w-8 text-[var(--pos-accent)]" />
            </div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {description || "This module is currently under development."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please check back later for updates.
            </p>
          </CardContent>
        </Card>
      </div>
    </PosLayout>
  );
}
