// src/services/bank.service.ts
import { db } from '../db'; 
import { banks } from '../db/schema'; 
import { eq } from 'drizzle-orm';

export class BankService {
  // Lấy toàn bộ danh sách ngân hàng sắp xếp theo ID
  async getAllBanks() {
    return await db.select().from(banks).orderBy(banks.id);
  }

  // Lấy chi tiết một ngân hàng theo ID
  async getBankById(id: number) {
    const result = await db.select().from(banks).where(eq(banks.id, id)).limit(1);
    return result[0] || null;
  }

  // Admin tạo mới ngân hàng (Trả về data sạch vừa tạo bằng insertId)
  async createBank(data: {
    name: string;
    logo?: string | null;
    preferentialRate: string;
    preferentialTerm: number;
    floatingRate: string;
    maxTerm: number;
  }) {
    const [result] = await db.insert(banks).values({
      name: data.name,
      logo: data.logo || null,
      preferentialRate: data.preferentialRate,
      preferentialTerm: data.preferentialTerm,
      floatingRate: data.floatingRate,
      maxTerm: data.maxTerm,
    });
    
    const insertId = result.insertId;
    const newBank = await db.select().from(banks).where(eq(banks.id, insertId)).limit(1);
    return newBank[0];
  }

  // Admin cập nhật thông tin ngân hàng dựa vào ID
  async updateBank(id: number, data: {
    name?: string;
    logo?: string | null;
    preferentialRate?: string;
    preferentialTerm?: number;
    floatingRate?: string;
    maxTerm?: number;
  }) {
    await db.update(banks).set(data).where(eq(banks.id, id));
    return await this.getBankById(id);
  }

  // Admin xóa ngân hàng khỏi hệ thống
  async deleteBank(id: number) {
    const checkExist = await this.getBankById(id);
    if (!checkExist) return false;
    
    await db.delete(banks).where(eq(banks.id, id));
    return true;
  }
}

export const bankService = new BankService();