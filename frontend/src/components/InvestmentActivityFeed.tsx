import React, { useMemo, useState } from 'react';
import {
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Button,
  Divider,
} from '@mui/material';
import { ExpandMore, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { InvestmentTimelineEvent } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

interface InvestmentActivityFeedProps {
  events: InvestmentTimelineEvent[]; // ascending date order
  pageSize?: number;
}

const EventRow: React.FC<{ event: InvestmentTimelineEvent }> = ({ event }) => {
  const isInvested = event.direction === 'invested';
  const destination = event.group === 'A' && event.to_account_name
    ? `${event.account_name} → ${event.to_account_name}`
    : event.account_name;

  return (
    <ListItem divider>
      <ListItemIcon sx={{ minWidth: 36 }}>
        {isInvested ? <ArrowUpward color="success" fontSize="small" /> : <ArrowDownward color="error" fontSize="small" />}
      </ListItemIcon>
      <ListItemText
        primary={
          <Box display="flex" justifyContent="space-between" alignItems="center" gap={1}>
            <Typography variant="body2" fontWeight="medium">
              {isInvested ? 'Invested' : 'Withdrawn'} {formatCurrency(event.amount)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDate(event.date)}
            </Typography>
          </Box>
        }
        secondary={
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap" mt={0.5}>
            <Typography variant="caption" color="text.secondary">{destination}</Typography>
            {event.group === 'A' && <Chip size="small" label="Balance-tracked" variant="outlined" />}
            {event.group === 'B' && event.realized_gain_loss_delta != null && event.realized_gain_loss_delta > 0 && (
              <Chip size="small" color="success" label={`+${formatCurrency(event.realized_gain_loss_delta)} realized`} />
            )}
          </Box>
        }
      />
    </ListItem>
  );
};

const CappedList: React.FC<{ events: InvestmentTimelineEvent[]; pageSize: number }> = ({ events, pageSize }) => {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const newestFirst = useMemo(() => [...events].reverse(), [events]);
  const visible = newestFirst.slice(0, visibleCount);

  return (
    <Box>
      <List dense disablePadding>
        {visible.map(event => (
          <EventRow key={event.id} event={event} />
        ))}
      </List>
      {visibleCount < newestFirst.length && (
        <Box textAlign="center" py={1}>
          <Button size="small" onClick={() => setVisibleCount(c => c + pageSize)}>
            Load more ({newestFirst.length - visibleCount} more)
          </Button>
        </Box>
      )}
    </Box>
  );
};

/**
 * Chronological (newest-first) feed of invest/withdraw events, grouped by category for Group B
 * and lumped under "Balance-Tracked Accounts" for Group A. Purely client-side pagination — the
 * full filtered event list is already in memory, "Load more" just reveals more of it.
 */
const InvestmentActivityFeed: React.FC<InvestmentActivityFeedProps> = ({ events, pageSize = 25 }) => {
  const groups = useMemo(() => {
    const byGroup = new Map<string, { label: string; color?: string; events: InvestmentTimelineEvent[] }>();

    events.forEach(e => {
      const key = e.group === 'B' && e.category_id ? e.category_id : 'group-a';
      if (!byGroup.has(key)) {
        byGroup.set(key, {
          label: e.group === 'B' ? (e.category_name || 'Category') : 'Balance-Tracked Accounts',
          color: e.category_color,
          events: [],
        });
      }
      byGroup.get(key)!.events.push(e);
    });

    return Array.from(byGroup.values()).sort((a, b) => b.events.length - a.events.length);
  }, [events]);

  if (events.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography color="text.secondary">No investment activity for the selected filters</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {groups.map((group, idx) => (
        <Accordion key={group.label + idx} defaultExpanded={idx === 0}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box display="flex" alignItems="center" gap={1}>
              {group.color && (
                <Box sx={{ width: 12, height: 12, backgroundColor: group.color, borderRadius: 0.5, flexShrink: 0 }} />
              )}
              <Typography variant="subtitle2">{group.label}</Typography>
              <Chip size="small" label={group.events.length} variant="outlined" />
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            <Divider />
            <CappedList events={group.events} pageSize={pageSize} />
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default InvestmentActivityFeed;
