'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  startAfter, 
  where, 
  QueryDocumentSnapshot, 
  DocumentData 
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { orgIdOf } from '@/lib/org';
import { History, Loader2, RefreshCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AuditLogPage() {
  const { firestore, userData } = useFirebase();
  const { toast } = useToast();
  const orgId = orgIdOf(userData);
  
  const [logs, setLogs] = useState<any[]>([]);
  const lastDoc = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const PAGE_SIZE = 100;

  const fetchLogs = useCallback(async (isInitial = true) => {
    if (!firestore || !orgId) return;

    if (isInitial) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      const logsRef = collection(firestore, 'auditLog');
      const ownOrg = where('organizationId', '==', orgId);
      let q = query(logsRef, ownOrg, orderBy('timestamp', 'desc'), limit(PAGE_SIZE));

      if (!isInitial && lastDoc.current) {
        q = query(logsRef, ownOrg, orderBy('timestamp', 'desc'), startAfter(lastDoc.current), limit(PAGE_SIZE));
      }

      const snapshot = await getDocs(q);
      
      const newLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (isInitial) {
        setLogs(newLogs);
      } else {
        setLogs(prev => [...prev, ...newLogs]);
      }

      lastDoc.current = snapshot.docs[snapshot.docs.length - 1] || null;
      setHasMore(snapshot.docs.length === PAGE_SIZE);

    } catch (err: any) {
      console.error(err);
      toast({ 
        title: "Fetch Failed", 
        description: "Could not retrieve audit records.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [firestore, orgId, toast]);

  useEffect(() => {
    if (!firestore) return;
    if (!orgId) {
      setLogs([]);
      setHasMore(false);
      setIsLoading(false);
      return;
    }
    fetchLogs(true);
  }, [firestore, orgId, fetchLogs]);

  if (isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Retrieving system history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Audit Log</h1>
          <p className="text-muted-foreground">
            Immutable record of all administrative actions and status changes.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchLogs(true)}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh Log
        </Button>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Timestamp</TableHead>
              <TableHead>Admin / User</TableHead>
              <TableHead>Action Taken</TableHead>
              <TableHead>Target Entity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log, index) => (
              <TableRow key={log.id} className={index % 2 === 1 ? 'bg-muted/20' : ''}>
                <TableCell className="font-mono text-[10px] whitespace-nowrap">
                  {log.timestamp?.seconds 
                    ? new Date(log.timestamp.seconds * 1000).toLocaleString() 
                    : log.timestamp || 'N/A'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">{log.adminName || 'System'}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{log.adminId || 'automated'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-medium bg-primary/5 text-primary border-primary/20">
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{log.affectedStudent || log.targetType || 'Record'}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{log.targetId}</span>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {Object.entries(log.details)
                          .filter(([, value]) => value !== null && value !== '')
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(' · ')}
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {logs.length === 0 && (
          <div className="text-center py-20 text-muted-foreground italic">
            {orgId
              ? 'No audit records yet. Submissions, decisions, invitations and scholarship changes are recorded here as they happen.'
              : 'Your account is not linked to an organization, so there is no history to show.'}
          </div>
        )}
      </div>

      {hasMore && logs.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button 
            variant="ghost" 
            onClick={() => fetchLogs(false)} 
            disabled={isLoadingMore}
            className="w-full max-w-xs border-dashed border-2"
          >
            {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <History className="h-4 w-4 mr-2" />}
            {isLoadingMore ? 'Loading Records...' : 'Load Previous Entries'}
          </Button>
        </div>
      )}
    </div>
  );
}
