import { useState } from 'react'
import {apiRequest} from '@/lib/api'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'

function EditPanel({title, record, detailField, detailLabel, endpoint, responseKey, onExit, onSave}){

    const[name, setName] = useState(record.name)
    const[detail, setDetail] = useState(record[detailField] || '')
    const[saving, setSaving] = useState(false)
    const[error, setError] = useState('')

async function handleSave(event){

    event.preventDefault()

    if (saving){

        return
    }

    const newName = name.trim()
    const newDetail = detail.trim()

    if (newName == ''){

        setError("Name is needed")
        return
    } 

    const modify = {}

    if (newName != record.name){

        modify.name = newName
    }

    if (newDetail != (record[detailField] || '')){

        modify[detailField] = newDetail
 
    }

    if (Object.keys(modify).length == 0){

        setError("No changes yet.")
        return
    }

    setSaving(true)
    setError('')

    try{
        const url = endpoint + '/' + record.id 

        const data = await apiRequest(url, {method: "PATCH", body: modify})

        onSave(data[responseKey])


    }
    catch (err){

        if(err.status == 404 || err.status == 405){

            setError("This action is not available")

        } else {

            setError(err.message || "Changes can not save")
        }
        
    }
    finally {

        setSaving(false)
    }
  }

  return (

    <aside className="admin-create-panel"> 
    <h3>{title}</h3>
    <p>Editing {record.id}</p>
    <form className="admin-create-form" onSubmit={handleSave}>
      {error && <div className="admin-notice is-error">{error}</div>}
      <div className="admin-field">
        <Label htmlFor="edit-name">Name *</Label>
        <Input id="edit-name" className="admin-input" value={name} maxLength={120} disabled={saving} onChange={(event)=>setName(event.target.value)}
        /> 
      </div>

      <div className="admin-field">
        <Label htmlFor="edit-detail"> {detailLabel} (optional)</Label>
        <textarea id="edit-detail" className="admin-textarea" rows={3} value={detail} disabled={saving} onChange={(event)=>setDetail(event.target.value)}
        />
      </div>

      <div className="admin-form-actions">
        <Button type="button" variant="outline" className="admin-btn admin-btn-outline" onClick={onExit} disabled={saving}
        > 
        Cancel 
        </Button>

        <Button type="submit" className="admin-btn admin-btn-primary" disabled={saving}
        >
            {saving ? "Saving..." : "Saved Changes"}
        </Button>

      </div>

    </form>
    
    </aside>
  )

    
}

export default EditPanel





