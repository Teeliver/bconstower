// src/routes/banks.ts
import { Hono } from 'hono';
import { bankService } from '../services/bank.service';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const bankApp = new Hono();

// [GET] /api/banks -> Lấy toàn bộ danh sách ngân hàng
bankApp.get('/', async (c) => {
  try {
    const data = await bankService.getAllBanks();
    return c.json(data, 200);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// [GET] /api/banks/:id -> Lấy chi tiết 1 ngân hàng theo ID
bankApp.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) return c.json({ success: false, message: 'ID không hợp lệ' }, 400);

    const bank = await bankService.getBankById(id);
    if (!bank) return c.json({ success: false, message: 'Không tìm thấy ngân hàng' }, 404);

    return c.json(bank, 200);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// [POST] /api/banks -> Thêm mới ngân hàng xử lý FormData
bankApp.post('/', async (c) => {
  try {
    const body = await c.req.parseBody(); 
    
    if (!body.name || !body.preferential_rate || !body.preferential_term || !body.floating_rate || !body.max_term) {
      return c.json({ success: false, message: 'Vui lòng điền đầy đủ thông tin bắt buộc' }, 400);
    }

    let logoPath = '';
    const logoFile = body.logo;
    if (logoFile && logoFile instanceof Blob && logoFile.size > 0) {
      const arrayBuffer = await logoFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileName = `${Date.now()}-${(logoFile as any).name || 'logo.png'}`;
      
      const uploadDir = join(process.cwd(), 'public', 'uploads');
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }
      
      writeFileSync(join(uploadDir, fileName), buffer);
      logoPath = `/uploads/${fileName}`; 
    }

    const newBank = await bankService.createBank({
      name: String(body.name),
      logo: logoPath || null,
      preferentialRate: String(body.preferential_rate),
      preferentialTerm: parseInt(body.preferential_term as string, 10) || 0,
      floatingRate: String(body.floating_rate),
      maxTerm: parseInt(body.max_term as string, 10) || 0
    });

    return c.json({ success: true, message: 'Tạo ngân hàng mới thành công', data: newBank }, 201);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// [PUT] /api/banks/:id -> Cập nhật sửa đổi ngân hàng theo ID
bankApp.put('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) return c.json({ success: false, message: 'ID không hợp lệ' }, 400);

    const body = await c.req.parseBody();
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = String(body.name);
    
    const logoFile = body.logo;
    if (logoFile && logoFile instanceof Blob && logoFile.size > 0) {
      const arrayBuffer = await logoFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileName = `${Date.now()}-${(logoFile as any).name || 'logo.png'}`;
      
      const uploadDir = join(process.cwd(), 'public', 'uploads');
      if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
      
      writeFileSync(join(uploadDir, fileName), buffer);
      updateData.logo = `/uploads/${fileName}`;
    }

    if (body.preferential_rate !== undefined) updateData.preferentialRate = String(body.preferential_rate);
    if (body.preferential_term !== undefined) updateData.preferentialTerm = parseInt(body.preferential_term as string, 10) || 0;
    if (body.floating_rate !== undefined) updateData.floatingRate = String(body.floating_rate);
    if (body.max_term !== undefined) updateData.maxTerm = parseInt(body.max_term as string, 10) || 0;

    const updatedBank = await bankService.updateBank(id, updateData);
    if (!updatedBank) return c.json({ success: false, message: 'Không tìm thấy ngân hàng' }, 404);

    return c.json({ success: true, message: 'Cập nhật thông tin thành công', data: updatedBank }, 200);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// [DELETE] /api/banks/:id -> Xóa ngân hàng khỏi hệ thống
bankApp.delete('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) return c.json({ success: false, message: 'ID không hợp lệ' }, 400);

    const isDeleted = await bankService.deleteBank(id);
    if (!isDeleted) return c.json({ success: false, message: 'Không tìm thấy ngân hàng để xóa' }, 404);

    return c.json({ success: true, message: 'Xóa ngân hàng thành công' }, 200);
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

export default bankApp;