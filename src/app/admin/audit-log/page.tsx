'use client';

import { useState, useEffect, useCallback } from 'react';
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
  QueryDocumentSnapshot, 
  DocumentData 
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { History, Loader2, RefreshCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AuditLogPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [logs, setLogs] = useState<any[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const PAGE_SIZE = 100;

  const fetchLogs = useCallback(async (isInitial = true) => {
    if (!firestore) return;

    if (isInitial) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      const logsRef = collection(firestore, 'auditLog');
      let q = query(logsRef, orderBy('timestamp', 'desc'), limit(PAGE_SIZE));

      if (!isInitial && lastDoc) {
        q = query(logsRef, orderBy('timestamp', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));
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

      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
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
  }, [firestore, lastDoc, toast]);

  useEffect(() => {
    fetchLogs(true);
  }, [fetchLogs]);

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
                    <span className="text-sm font-medium">{log.affectedStudent || 'Application Record'}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{log.targetId}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {logs.length === 0 && (
          <div className="text-center py-20 text-muted-foreground italic">
            No audit records found in the current history.
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
