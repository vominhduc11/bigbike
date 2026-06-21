import { useState } from 'react'
import { Modal } from '../../components/layout'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SerialListPanel } from './SerialListPanel'
import { AddSerialsPanel } from './AddSerialsPanel'

export function SerialManageModal({ item, onClose }) {
  const [activeTab, setActiveTab] = useState('list')
  const [listRefreshKey, setListRefreshKey] = useState(0)

  const title = [item.productName, item.variantName].filter(Boolean).join(' · ')

  return (
    <Modal open wide title={`Quản lý serial — ${title}`} onClose={onClose}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex -mx-5 px-5 mb-4">
          <TabsTrigger value="list">Danh sách serial</TabsTrigger>
          <TabsTrigger value="add">Thêm serial mới</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-0">
          <SerialListPanel item={item} refreshKey={listRefreshKey} />
        </TabsContent>
        <TabsContent value="add" className="mt-0">
          <AddSerialsPanel
            item={item}
            onSuccess={() => { setActiveTab('list'); setListRefreshKey((k) => k + 1) }}
          />
        </TabsContent>
      </Tabs>
    </Modal>
  )
}
